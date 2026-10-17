package expo.modules.testlab

import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Firebase Test Lab（Google Play の「テスト前レポート」＝自動ロボット試験の実行環境）判定。
// Test Lab 上では System.getString(cr, "firebase.test.lab") == "true"（Google 公式の判定方法）。
// 該当時は JS 側でテレメトリ／お試しを送らない＝ダッシュボード・生データ・device_trials を汚さない。
class TestLabModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("TestLab")

    Function("isTestLab") {
      val ctx = appContext.reactContext ?: return@Function false
      "true" == Settings.System.getString(ctx.contentResolver, "firebase.test.lab")
    }
  }
}
