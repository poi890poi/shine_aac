package org.shineaac.inputs

import java.util.concurrent.Callable
import java.util.concurrent.ExecutionException
import java.util.concurrent.Executors
import java.util.concurrent.Future

/** Creates, uses and closes a native resource on one owner thread. */
internal class ThreadOwnedResource<T : AutoCloseable>(name: String, factory: () -> T) : AutoCloseable {
    private val executor = Executors.newSingleThreadExecutor { runnable ->
        Thread(runnable, name).apply { isDaemon = true }
    }
    private val gate = Any()
    private var closing: Future<*>? = null
    private val resource: T = try {
        await(executor.submit(Callable { factory() }))
    } catch (error: Throwable) {
        executor.shutdown()
        throw error
    }

    fun <R> use(block: (T) -> R): R {
        val future = synchronized(gate) {
            check(closing == null) { "Resource is closed" }
            executor.submit(Callable { block(resource) })
        }
        return await(future)
    }

    override fun close() {
        val future = synchronized(gate) {
            closing ?: executor.submit { resource.close() }.also {
                closing = it
                executor.shutdown()
            }
        }
        await(future)
    }

    private fun <R> await(future: Future<R>): R {
        // Retain image/resource ownership until native work actually finishes,
        // even if a camera executor is interrupted during Activity teardown.
        var interrupted = false
        try {
            while (true) {
                try { return future.get() }
                catch (_: InterruptedException) { interrupted = true }
                catch (error: ExecutionException) { throw (error.cause ?: error) }
            }
        } finally {
            if (interrupted) Thread.currentThread().interrupt()
        }
    }
}
