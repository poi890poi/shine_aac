package org.shineaac.inputs

import org.junit.Assert.*
import org.junit.Test
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

class ThreadOwnedResourceTest {
    @Test fun creationUseAndIdempotentCloseShareOneThread() {
        val threads = mutableListOf<Long>()
        val closes = AtomicInteger()
        val resource = ThreadOwnedResource("owner-test") {
            threads.add(Thread.currentThread().id)
            AutoCloseable { threads.add(Thread.currentThread().id); closes.incrementAndGet() }
        }
        resource.use { threads.add(Thread.currentThread().id) }
        resource.close()
        resource.close()
        assertEquals(1, closes.get())
        assertEquals(1, threads.distinct().size)
        assertNotEquals(Thread.currentThread().id, threads.first())
        try { resource.use { }; fail("Use after close accepted") }
        catch (_: IllegalStateException) { }
    }

    @Test fun interruptedCallerRetainsResourceUntilInferenceFinishes() {
        val entered = CountDownLatch(1)
        val release = CountDownLatch(1)
        val returned = CountDownLatch(1)
        val interruptedAfter = AtomicInteger()
        val resource = ThreadOwnedResource("interrupt-test") { AutoCloseable { } }
        val caller = Thread {
            resource.use { entered.countDown(); release.await() }
            if (Thread.currentThread().isInterrupted) interruptedAfter.incrementAndGet()
            returned.countDown()
        }
        caller.start()
        assertTrue(entered.await(2, TimeUnit.SECONDS))
        caller.interrupt()
        assertFalse(returned.await(50, TimeUnit.MILLISECONDS))
        release.countDown()
        assertTrue(returned.await(2, TimeUnit.SECONDS))
        resource.close()
        assertEquals(1, interruptedAfter.get())
    }

    @Test fun closeWaitsForAcceptedWorkAndPreservesFailureCause() {
        val entered = CountDownLatch(1)
        val release = CountDownLatch(1)
        val closed = CountDownLatch(1)
        val resource = ThreadOwnedResource("close-test") { AutoCloseable { closed.countDown() } }
        val caller = Thread { resource.use { entered.countDown(); release.await() } }
        caller.start()
        assertTrue(entered.await(2, TimeUnit.SECONDS))
        val closer = Thread { resource.close() }
        closer.start()
        assertFalse(closed.await(50, TimeUnit.MILLISECONDS))
        release.countDown()
        caller.join(2000); closer.join(2000)
        assertEquals(0L, closed.count)
        val expected = IllegalArgumentException("creation failed")
        try { ThreadOwnedResource<AutoCloseable>("failure-test") { throw expected }; fail() }
        catch (error: IllegalArgumentException) { assertSame(expected, error) }
    }
}
