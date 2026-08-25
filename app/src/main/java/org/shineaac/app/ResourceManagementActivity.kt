package org.shineaac.app

import android.content.Context
import android.content.res.Configuration
import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.ProgressBar
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.work.WorkInfo
import androidx.work.WorkManager
import com.google.android.material.appbar.MaterialToolbar
import com.google.android.material.snackbar.Snackbar
import org.shineaac.inputs.CheekModelResource
import java.util.Locale

class ResourceManagementActivity : AppCompatActivity() {
    private lateinit var cheekStatus: TextView
    private lateinit var cheekAction: Button
    private lateinit var progress: ProgressBar

    override fun attachBaseContext(newBase: Context) {
        val profileId = SettingsStore.stringValue(newBase, "profileId", "en-US")
        val configuration = Configuration(newBase.resources.configuration).apply {
            setLocale(Locale.forLanguageTag(profileId))
        }
        super.attachBaseContext(newBase.createConfigurationContext(configuration))
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_resource_management)

        findViewById<MaterialToolbar>(R.id.resource_toolbar).apply {
            setNavigationOnClickListener { onBackPressedDispatcher.onBackPressed() }
        }
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.resource_root)) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            insets
        }

        cheekStatus = findViewById(R.id.cheek_resource_status)
        cheekAction = findViewById(R.id.cheek_resource_action)
        progress = findViewById(R.id.cheek_resource_progress)
        cheekAction.setOnClickListener { handleCheekAction() }

        WorkManager.getInstance(this)
            .getWorkInfosForUniqueWorkLiveData(ResourceDownloadWorker.UniqueWorkName)
            .observe(this) { work -> render(work.maxByOrNull { it.runAttemptCount }) }
        render(null)
    }

    override fun onResume() {
        super.onResume()
        render(null)
    }

    private fun handleCheekAction() {
        val downloaded = CheekModelResource.verifiedManagedFile(this)
        when {
            downloaded != null -> {
                if (downloaded.delete()) {
                    pruneEmptyParents(downloaded.parentFile, filesDir)
                    Snackbar.make(
                        findViewById(R.id.resource_root),
                        R.string.resources_download_removed,
                        Snackbar.LENGTH_SHORT,
                    ).show()
                }
                render(null)
            }
            CheekModelResource.AvailableVersion > CheekModelResource.BundledVersion -> {
                ResourceDownloadWorker.enqueue(this)
            }
            else -> Snackbar.make(
                findViewById(R.id.resource_root),
                R.string.resources_up_to_date,
                Snackbar.LENGTH_SHORT,
            ).show()
        }
    }

    private fun render(work: WorkInfo?) {
        val downloaded = CheekModelResource.verifiedManagedFile(this) != null
        val running = work?.state == WorkInfo.State.RUNNING || work?.state == WorkInfo.State.ENQUEUED
        progress.visibility = if (running) View.VISIBLE else View.GONE
        if (running) {
            progress.isIndeterminate = true
        }
        when {
            downloaded -> {
                cheekStatus.setText(R.string.resources_status_downloaded)
                cheekAction.setText(R.string.resources_remove_download)
                cheekAction.isEnabled = !running
            }
            running -> {
                cheekStatus.setText(R.string.resources_status_downloading)
                cheekAction.setText(R.string.resources_downloading)
                cheekAction.isEnabled = false
            }
            CheekModelResource.AvailableVersion > CheekModelResource.BundledVersion -> {
                cheekStatus.setText(R.string.resources_status_update_available)
                cheekAction.setText(R.string.resources_download_update)
                cheekAction.isEnabled = true
            }
            else -> {
                cheekStatus.setText(R.string.resources_status_included)
                cheekAction.setText(R.string.resources_up_to_date_action)
                cheekAction.isEnabled = true
            }
        }
    }

    private fun pruneEmptyParents(start: java.io.File?, stop: java.io.File) {
        var directory = start
        while (directory != null && directory != stop && directory.list().isNullOrEmpty()) {
            val parent = directory.parentFile
            directory.delete()
            directory = parent
        }
    }
}
