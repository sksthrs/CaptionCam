# CaptionCam （字幕カメラ）
Camera with automated caption on your browser（Webブラウザで動作する自動字幕つきカメラ）

# デモ
https://sksthrs.github.io/CaptionCam/

# 元ネタ
下記リポジトリのアイデアを別方法で実装しました。

https://github.com/1heisuzuki/speech-to-text-webcam-overlay

# 元ネタとの違い
- スマートフォンでも一応は動作（AndroidのChrome、iPhoneのSafariで確認）
- WindowsのWebView2でも動作（※Edgeで動作する場合）
- 字幕カメラを表示したまま設定変更可能
- 常に表示範囲全体にカメラ（と字幕）を展開

# PCでの注意点（2022年11月情報）
- Edgeは、PCによっては音声認識ができないようです。いくつかのPCで試した範囲だと、Intel Core iの第5世代は動作したものの、第2世代は動作しませんでした。

# スマートフォンでの注意点（2022年11月情報）
- AndroidのChromeやEdgeでは動作します（Vivaldiでも動作しました……）。ホーム画面にインストールしても使えます。ただし、音声認識の出力が遅い印象です。
- iPhoneのSafariでは動作します。Androidよりも早く音声認識の出力が出る印象です。ただし、ホーム画面に追加しても使えません。
