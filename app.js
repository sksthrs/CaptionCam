'use strict';

/**
 * 音声認識結果の現状と履歴をまとめて管理する
 */
class SpeechLog {
  /**
   * コンストラクタ
   * @param {(message:string) => void} onLog ログ発生時のイベント処理関数
   */
  constructor(onLog = undefined) {
    /** @type {number} 現在の音声認識結果として表示可能な文字列の最大の長さ */
    this.maxCharacters = 300

    /** @type {Array<SpeechRecognitionResult>} 音声認識が確定した文字列の配列 */
    this.wholeLog = []

    /** @type {Array<SpeechRecognitionResult>} 音声認識が確定した「現状の」結果の配列 */
    this.currentResults = []

    /** @type {Array<SpeechRecognitionResult>} 未確定の音声認識結果の配列 */
    this.interimResults = []

    /** @type {number} 音声認識が確定した最大のindex（開始前は-1） */
    this.indexFinished = -1

    /** @type {(message:string) => void} ログ発生イベント処理関数（外側から設定する） */
    this.onLog = (onLog != null) ? onLog : (message) => {}
  }

  /** 
   * 音声認識結果の現状を初期化する（履歴は初期化しない）。
   * 音声認識のstartごとに実行する。
   */
  init() {
    if (this.currentResults.length > 0) {
      this.wholeLog.push(...this.currentResults)
    }
    this.currentResults = []
    this.interimResults = []
    this.indexFinished = -1
    return
  }

  /**
   * 音声認識結果により内部状態を更新する。
   * @param {SpeechRecognitionEvent} result
   * @return {boolean} 変更の有無（変更があった場合true）
   */
  update(result) {
    if (this.indexFinished >= result.resultIndex) {
      this.onLog(`[warning] resultIndex(${result.resultIndex}) is no more than finished(${this.indexFinished})`)
    }

    const results = this._extractUpdate(result)
    if (results.length < 1) return false
    this.interimResults = []
    results.forEach(r => this._pushUpdate(r))
    return true
  }

  /**
   * 引数が通常の文字列か判定する。簡易版なので new String('hello') は文字列とはみなさない。
   * @param {any} value 判定対象
   * @returns {boolean} trueなら文字列
   */
  isString(value) {
    return (typeof value === 'string')
  }

  /**
   * 配列の最後の項目を取得する。配列そのものは変更しない。
   * @param {Array<T>} array 
   * @returns {T | null} 配列の最後の項目（配列が空の場合はnull）
   */
  getLastItem(array) {
    if (array.length < 1) return null
    return array.at(-1)
  }

  // /**
  //  * 現状の音声認識結果の最後（最新）の項目があれば取得する。なければnullを返す。
  //  * @returns {SpeechRecognitionResult | null}
  //  */
  // _getLatestResult() {
  //   if (this.currentResults.length < 1) return null
  //   return this.currentResults.at(-1)
  // }

  /**
   * 音声認識結果を追加する。
   * @param {SpeechRecognitionResult} result 
   */
  _pushUpdate(result) {
    if (result.isFinal) {
      // 確定部分の処理（AndroidのChromeで内容が重複するので除去）
      const last = this.getLastItem(this.currentResults)
      if (last != null && result[0].transcript.startsWith(last[0].transcript)) {
        this.currentResults.pop()
      }
      this.currentResults.push(result)
    } else {
      // 未確定部分の処理（未確定部分は普通１件だとは思うが一応全部連結）
      // const last = getLastItem(this.interimResults)
      // if (last != null && result[0].transcript.startsWith(last[0].transcript)) {
      //   this.interimResults.pop()
      // }
      this.interimResults.push(result)
    }
  }

  /**
   * 音声認識結果から、今回更新されたもののうち、有効なものを抽出する。
   * あわせて、indexFinishedの値を更新する。
   * @param {SpeechRecognitionEvent} result 
   * @returns {Array<SpeechRecognitionResult>} 音声認識結果の更新分のうち有効なものの配列
   */
  _extractUpdate(result) {
    const updatedItems = []
    let ixBegin = Math.max(this.indexFinished, result.resultIndex)
    for (let ix=ixBegin ; ix<result.results.length ; ix++) {
      // 認識完了インデックスの更新
      if (result.results[ix].isFinal === true) {
        this.indexFinished = Math.max(ix, this.indexFinished)
      }
      // 字幕のチェック
      let transcript = result.results[ix][0].transcript
      // AndroidのChromeで空文字列が次々確定されるので無視
      if (transcript != null && transcript.length > 0) {
        let newItem = result.results[ix]
        updatedItems.push(newItem)
      }
    }
    // 調査用に数だけログに保存
    if (updatedItems.length > 0) {
      this.onLog(`onresult new items(${updatedItems.length}) index=${result.resultIndex}`)
    }
    return updatedItems
  }

  /**
   * 現状の結果配列を走査し、音声認識結果を連結した文字数が最大値以下に収まるように、
   * 古い結果を削除する。
   */
  _trimCurrentResults() {
    let sum = 0
    let ix = this.currentResults.length-1
    for ( ; ix>=0 ; ix--) {
      sum += this.currentResults[ix][0].transcript.length
      // 所定の文字数を超過したら、ここまでの結果を「現状の結果配列」から除去
      if (sum > this.maxCharacters) {
        for (let i=0 ; i<=ix ; i++) {
          this.currentResults.shift()
        }
        break
      }
    }
  }

  /**
   * 引数が約物で終わっていない場合は「。」をつけて返す。
   * @param {string} text
   * @return {string} 約物で終わる文字列（文字列以外、または空文字列の場合は空文字列）
   */
  _addPunctuationIfNotExists(text) {
    if (this.isString(text) !== true || text.length < 1) return ''
    if (text.endsWith('。') || text.endsWith('、') 
    || text.endsWith('？') || text.endsWith('！')
    || text.endsWith('.') || text.endsWith(',') 
    || text.endsWith('?') || text.endsWith('!')) {
      return text
    } else {
      return text + '。'
    }
  }

  /**
   * 現在の音声認識結果を取得する。
   * @returns {string} 現在の音声認識結果
   */
  getCurrentSpeech() {
    let text = ''
    this.currentResults.forEach((r) => {
      let newText = r[0].transcript
      text += this._addPunctuationIfNotExists(newText)
    })
    this.interimResults.forEach((r) => {
      let newText = r[0].transcript
      text += newText
    })
    return text
  }

  /**
   * これまでの全ての字幕ログを一括で取得する。
   * @returns {Array<string>} 字幕ログ
   */
  getWholeLog() {
    /** @type {Array<string>} 字幕ログ */
    const log = []
    this.onLog(`wholeLog(${this.wholeLog.length})`)
    this.wholeLog.forEach((r) => {
      let newText = r[0].transcript
      log.push(this._addPunctuationIfNotExists(newText)+'\n')
    })
    this.currentResults.forEach((r) => {
      let newText = r[0].transcript
      log.push(this._addPunctuationIfNotExists(newText)+'\n')
    })
    this.interimResults.forEach((r) => {
      let newText = r[0].transcript
      log.push(this._addPunctuationIfNotExists(newText)+'\n')
    })
    return log
  }
} // SpeechLogクラスの終端


/**
 * 音声認識オブジェクトを管理するクラス
 */
class SpeechRecognizerOptions {
  constructor() {
    /** @type {SpeechLog} 音声認識結果の管理クラス */
    this.speechLog = null
    /** @type {(text:string) => void} 字幕更新イベント処理関数（外側から設定する） */
    this.onUpdated = (text) => {}
    /** @type {(message:string) => void} 致命的なエラー発生イベント処理関数（外側から設定する） */
    this.onCritical = (message) => {}
    /** @type {(message:string) => void} ログ発生イベント処理関数（外側から設定する） */
    this.onLog = (message) => {}
  }
}

/**
 * 音声認識オブジェクトを管理する
 */
class SpeechRecognizer {
  /**
   * コンストラクタ
   * @param {SpeechRecognizerOptions} options
   */
  constructor(options = undefined) {
    /**
     * @type {SpeechRecognition | webkitSpeechRecognition | null | undefined} 
     * 音声認識オブジェクト。
     * 初期化前はundefined
     * 初期化後は適切なオブジェクトまたはnull（ブラウザが音声認識不可能な場合など） 
     */
    this.recognizer = undefined

    /** @type {boolean} 音声認識開始後で音声処理が可能かを示す（Chromium系ブラウザの多くのように音声認識オブジェクトはあるが実際にはできない場合、どうやらonaudiostartの後でエラーとなりonspeechstartができないようなので、その検出に利用） */
    this.isSpeechAvailable = false

    /** @type {boolean} 音声認識が使える（と考えられる）場合はtrue */
    this.available = true // とりあえず最初はtrueとしておく

    /** @type {SpeechLog} 音声認識結果を管理するオブジェクト */
    this.speechLog = (options.speechLog != null) ? options.speechLog : new SpeechLog()

    /** @type {(text:string) => void} 音声認識結果に更新があった場合のイベント処理関数 */
    this.onUpdated = (options.onUpdated != null) ? options.onUpdated : (text) => {}

    /** @type {(message:string) => void} 致命的なエラー発生イベント処理関数 */
    this.onCritical = (options.onCritical != null) ? options.onCritical : (text) => {}

    /** @type {(message:string) => void} ログ出力時のイベント処理関数 */
    this.onLog = (options.onLog != null) ? options.onLog : (text) => {}
  }

  init() {
    // ２回以上の呼び出しはできない
    if (this.recognizer !== undefined) return this.available

    // 音声認識オブジェクトの生成（Firefoxのようにエンジンレベルで非対応だと生成できない）
    if ('SpeechRecognition' in window) {
      this.onLog('SpeechRecognition found.')
      this.recognizer = new SpeechRecognition()
      this.available = true
    } else if ('webkitSpeechRecognition' in window) {
      this.onLog('webkitSpeechRecognition found.')
      this.recognizer = new webkitSpeechRecognition()
      this.available = true
    } else {
      this.onLog('SpeechRecognition not found.')
      this.recognizer = null
      this.available = false
      return false // 作れないのでここで終わり
    }

    // 最低限のパラメータ設定
    this.recognizer.continuous = true
    this.recognizer.interimResults = true
    this.recognizer.lang = navigator.language // デフォルト言語はブラウザの言語とする

    // イベント処理
    this.recognizer.onstart = () => { this.onLog('onstart') }
    this.recognizer.onaudiostart = () => { this.onLog('onaudiostart') }
    this.recognizer.onsoundstart = () => { this.onLog('onsoundstart') }
    this.recognizer.onspeechstart = () => {
      this.onLog('onspeechstart')
      this.isSpeechAvailable = true // onspeechstartできれば音声認識できる模様（例えばVivaldiはここに到達できない）
    }
    this.recognizer.onspeechend = () => { this.onLog('onspeechend') }
    this.recognizer.onsoundend = () => { this.onLog('onsoundend') }
    this.recognizer.onaudioend = () => { this.onLog('onaudioend') }
    this.recognizer.onend = () => {
      this.onLog('onend')
      this.speechLog.init()
      // 無音が続くと音声認識が終了するので、自動的に再開
      if (this.available) {
        this.start()
      }
    }
    this.recognizer.onerror = (ev) => {
      window.speechRecognizerError = ev
      this.onLog(`onerror(${ev.error}) detail:${JSON.stringify(ev)} msg:${ev.message}`)
      // start後、onspeechstartせずエラーになる場合は音声認識非対応ブラウザとみなす。
      // ただしno-speech（音声が入らない場合）などは別問題としておく。
      if (this.isSpeechAvailable !== true 
        && ev.error !== 'no-speech' && ev.error !== 'aborted') 
      {
        this.available = false
        this.onLog('this browser seems Speech-Recognition-Not-Available because error before onspeechstart.')
        this.onCritical(`エラー種別:${ev.error} (${ev.message})`)
      }
      // 継続可能な場合はonendに到達して自動的に再開を試みるはずなので何もしない。
    }
    this.recognizer.onnomatch = () => {
      this.onLog('onnomatch')
      // そのままonendに到達して自動的に再開を試みるはずなので何もしない。
    }
    this.recognizer.onresult = (ev) => {
      if (this.speechLog.update(ev)) {
        let caption = this.speechLog.getCurrentSpeech()
        this.onUpdated(caption)
      }
    }

    return true
  } // init()の終端

  start() {
    this.onLog('SpeechRecognizer.start() begins.')
    if (this.available !== true || this.recognizer == null) return false
    this.speechLog.init()
    this.recognizer.start()
    return true
  }
} // SpeechRecognizerクラスの終端


/*
 ========== ========== ========== ========== ========== ==========
 起動時設定
 ========== ========== ========== ========== ========== ==========
*/
window.addEventListener('DOMContentLoaded', (ev) => {

  const MY_NAME = 'CaptionCam'
  const STORAGE_KEY = MY_NAME + '/config'

  const FONT_SIZE_MAX = 20
  const FONT_SIZE_MIN = 3
  const LINE_HEIGHT_MAX = 200
  const LINE_HEIGHT_MIN = 100

  /** @type {number} SpeechRecognitionオブジェクト生成から音声認識開始までの待ち時間 */
  const WAIT_SPEECH_RECOGNITION = location.hash.toLowerCase() === '#app' ? 2000 : 10
  // WebView2だと、これを1000msec程度は確保しないと失敗する模様。
  // このため、WebView2に与えるURLは「#app」をつけることとして区別する。
  // 通常のブラウザでは、このような待ち時間は本来不要と思われる。

  /** @type {Array<string>} ログ */
  const logMessages = []

  /**
   * ログを出力する。
   * @param {string} message ログメッセージ
   */
  function log(message) {
    let ts = new Date()
    let msg = ts.toISOString() + " " + message
    console.log(msg)
    logMessages.push(msg+"\n")
  }

  /**
   * 引数が有限の数値か判定する。
   * https://zero-plus-one.jp/javascript/isnumber/
   * @param {any} value 判定対象
   * @returns {boolean} trueなら数値
   */
  function isNumber(value) {
    return (typeof value === 'number') && isFinite(value)
  }

  /**
   * ブラウザ表示領域が縦長か判定する。
   * @returns {boolean} trueなら縦長
   */
  function isPortrait() {
    return window.innerHeight > window.innerWidth
  }

  // ========== ========== 設定 ========== ==========

  /** 設定のデフォルト値 */
  const configDefault = {
    /** @type {number} フォントサイズ（vhで指定）。デフォルト値は「1行=表示領域の10%」になるよう設定 */
    fontSize: 7.6, 
    /** @type {number} 行の高さの、フォント高さに対する比率の%値。7.6*130/100=9.88≒10 */
    lineHeight: 130,
    /** @type {'bottom'|'top'|'left'|'right'} 字幕領域の位置（あわせて他の配置も変化する） */
    position: 'bottom'
  }

  /**
   * 設定オブジェクトを画面に反映する。
   * @param {any} config 
   */
  function singleConfigToScreen(config) {
    if (config.fontSize != null) {
      setCaptionFontSize(config.fontSize)
      log(`fontSize=${config.fontSize}`)
    }
    if (config.lineHeight != null) {
      setCaptionLineHeight(config.lineHeight)
      log(`lineHeight=${config.lineHeight}`)
    }
    if (setLayout(config.position)) {
      setPositionRadioButton(config.position)
      log(`position=${config.position}`)
    }
  }

  /**
   * 設定（localStorageまたはデフォルト値）を画面に反映する。
   */
  function configToScreen() {
    log(`configToScreen default settings : ${JSON.stringify(configDefault)}`)
    singleConfigToScreen(configDefault)
    const configJson = localStorage.getItem(STORAGE_KEY)
    log(`config(${STORAGE_KEY}) : ${configJson}`)
    if (configJson != null && configJson.length > 0) {
      try {
        const configStorage = JSON.parse(configJson)
        singleConfigToScreen(configStorage)
      } catch(err) {
        log(`JSON parse error : ${err}`)
        localStorage.removeItem(STORAGE_KEY)
      }
    }
  }

  /**
   * 画面上の現在の設定をlocalStorageに保存する。
   */
  function screenToConfig() {
    const newConfig = JSON.stringify(config)
    localStorage.setItem(STORAGE_KEY, newConfig)
    log(`screenToConfig : ${newConfig}`)
  }

  /**
   * 字幕位置文字列をもとに全体のレイアウトを設定する。
   * @param {'bottom' | 'top' | 'left' | 'right'} position 字幕位置を示す文字列
   * @return {boolean} trueならレイアウト設定が行われた。
   */
  function setLayout(position) {
    if (position === 'bottom') {
      setLayoutCaptionBottom()
      return true
    } else if (position === 'top') {
      setLayoutCaptionTop()
      return true
    } else if (position === 'left') {
      setLayoutCaptionLeft()
      return true
    } else if (position === 'right') {
      setLayoutCaptionRight()
      return true
    }
    return false
  }

  /**
   * 字幕を上に配置する場合のレイアウトを設定する。
   */
  function setLayoutCaptionTop() {
    // 字幕を上に配置
    captionContainer.style.top = '0'
    captionContainer.style.bottom = ''
    captionContainer.style.left = '0'
    captionContainer.style.right = ''
    captionContainer.style.width = '100%'
    captionContainer.style.height = '30%'
    // カメラは下寄せ
    cameraContainer.style.flexDirection = 'column'
    cameraContainer.style.justifyContent = 'flex-end'
  }

  /**
   * 字幕を下に配置する場合のレイアウトを設定する。
   */
  function setLayoutCaptionBottom() {
    // 字幕を下に配置
    captionContainer.style.top = ''
    captionContainer.style.bottom = '0'
    captionContainer.style.left = '0'
    captionContainer.style.right = ''
    captionContainer.style.width = '100%'
    captionContainer.style.height = '30%'
    // カメラは上寄せ
    cameraContainer.style.flexDirection = 'column'
    cameraContainer.style.justifyContent = 'flex-start'
  }

  /**
   * 字幕を左に配置する場合のレイアウトを設定する。
   */
   function setLayoutCaptionLeft() {
    // 字幕を左に配置
    captionContainer.style.top = '0'
    captionContainer.style.bottom = ''
    captionContainer.style.left = '0'
    captionContainer.style.right = ''
    captionContainer.style.width = '50%'
    captionContainer.style.height = '100%'
    // カメラは右寄せ
    cameraContainer.style.flexDirection = 'row'
    cameraContainer.style.justifyContent = 'flex-end'
  }

  /**
   * 字幕を右に配置する場合のレイアウトを設定する。
   */
   function setLayoutCaptionRight() {
    // 字幕を左に配置
    captionContainer.style.top = '0'
    captionContainer.style.bottom = ''
    captionContainer.style.left = ''
    captionContainer.style.right = '0'
    captionContainer.style.width = '50%'
    captionContainer.style.height = '100%'
    // カメラは右寄せ
    cameraContainer.style.flexDirection = 'row'
    cameraContainer.style.justifyContent = 'flex-start'
  }

  // ========== ========== HTML要素 ========== ==========

  window.addEventListener('resize', ev => {
    stretchCameraArea()
  })

  /** @type {HTMLDivElement} body内全域を占めるdiv要素 */
  const wholeArea = document.getElementById('content')

  wholeArea.addEventListener('click', ev => {
    // 設定領域以外をクリックした場合、設定領域の表示／非表示を切り替える。
    if (configArea.contains(ev.target) !== true) {
      toggleConfig()
    }
  })

  /** @type {HTMLDivElement} 字幕表示領域のコンテナ（Flexboxで字幕の配置を調整する） */
  const captionContainer = document.getElementById('caption-container')

  /** @type {HTMLDivElement} 字幕表示要素 */
  const captionArea = document.getElementById('caption')

  /**
   * 字幕のフォントサイズを設定する。
   * @param {number} size フォントサイズ（viewport高さに対するパーセント値）
   * @return {boolean} trueなら設定は有効
   */
   function setCaptionFontSize(size) {
    if (isNumber(size) !== true || size < FONT_SIZE_MIN || size > FONT_SIZE_MAX) return false
    config.fontSize = size
    captionArea.style.fontSize = `${size}vh`
    if (fontSizeInput.value !== size.toString()) {
      fontSizeInput.value = size.toString()
    }
    return true
  }

  /**
   * 字幕の行高さを設定する。
   * @param {number} height 行高さ（文字の高さに対するパーセント値）
   * @return {boolean} trueなら設定は有効
   */
   function setCaptionLineHeight(height) {
    if (isNumber(height) !== true || height < LINE_HEIGHT_MIN || height > LINE_HEIGHT_MAX) return false
    config.lineHeight = height
    captionArea.style.lineHeight = `${height}%`
    if (lineHeightInput.value !== height.toString()) {
      lineHeightInput.value = height.toString()
    }
    return true
  }

  /** @type {HTMLDivElement} カメラ表示領域のコンテナ（Flexboxでカメラの配置を調整する） */
  const cameraContainer = document.getElementById('camera-container')

  /** @type {HTMLVideoElement} カメラ表示領域 */
  const cameraArea = document.getElementById('camera')

  cameraArea.addEventListener('play', ev => {
    stretchCameraArea()
    doPostCameraSetup()
  })

  /**
   * カメラ表示領域のサイズを次の条件を満たす形で設定する。
   * (1) カメラ映像のアスペクト比を維持する。
   * (2) コンテナからはみ出さない。
   * (3) 少なくとも縦辺または横辺のいずれかはコンテナに接する。
   */
  function stretchCameraArea() {
    log(`stretchCameraArea video:(${cameraArea.videoWidth},${cameraArea.videoHeight})`)
    // カメラが利用できない場合は何もしない。
    if (cameraArea.videoWidth < 1 || cameraArea.videoHeight < 1) return
    const cameraAspectRatio = cameraArea.videoWidth / cameraArea.videoHeight

    const containerRect = cameraContainer.getBoundingClientRect()
    if (containerRect.height < 1) return
    const containerAspectRatio = containerRect.width / containerRect.height

    if (containerAspectRatio > cameraAspectRatio) {
      // カメラ映像がコンテナよりも縦長な場合：カメラ映像の高さをコンテナの高さにあわせる
      cameraArea.style.width = ''
      cameraArea.style.height = '100%'
    } else {
      // カメラ映像がコンテナよりも横長な場合：カメラ映像の幅をコンテナの幅にあわせる
      cameraArea.style.width = '100%'
      cameraArea.style.height = ''
    }
  }

  /** @type {HTMLDivElement} 設定領域 */
  const configArea = document.getElementById('config')

  /** 設定領域を表示する */
  function showConfig() {
    configArea.style.display = 'flex'
  }

  /** 設定領域を隠す */
  function hideConfig() {
    configArea.style.display = 'none'
  }

  /** 設定領域の表示／非表示を切り替える */
  function toggleConfig() {
    if (configArea.style.display === 'flex') {
      hideConfig()
    } else {
      showConfig()
    }
  }

  /** @type {HTMLSelectElement} 設定のカメラ一覧 */
  const cameraList = document.getElementById('config-camera-list')

  cameraList.addEventListener('change', ev => {
    setupCamera()
  })

  /** @type {HTMLInputElement} 設定のフォントサイズ設定欄 */
  const fontSizeInput = document.getElementById('config-font-size')

  fontSizeInput.addEventListener('change', ev => {
    onFontSizeInputChanged()
  })

  function onFontSizeInputChanged() {
    if (setCaptionFontSize(Number(fontSizeInput.value))) {
      screenToConfig()
    }
  }

  /** @type {HTMLButtonElement} 設定のフォントサイズ縮小ボタン */
  const fontSizeDecrement = document.getElementById('config-font-size-decrement')

  fontSizeDecrement.addEventListener('click', ev => {
    const fontSize = Number(fontSizeInput.value)
    const newSize = Math.max(Math.round((fontSize-0.1)*10)/10 , FONT_SIZE_MIN)
    if (fontSize !== newSize) {
      fontSizeInput.value = newSize.toString()
      onFontSizeInputChanged()
    }
  })

  /** @type {HTMLButtonElement} 設定のフォントサイズ拡大ボタン */
  const fontSizeIncrement = document.getElementById('config-font-size-increment')

  fontSizeIncrement.addEventListener('click', ev => {
    const fontSize = Number(fontSizeInput.value)
    const newSize = Math.min(Math.round((fontSize+0.1)*10)/10 , FONT_SIZE_MAX)
    if (fontSize !== newSize) {
      fontSizeInput.value = newSize.toString()
      onFontSizeInputChanged()
    }
  })

  /** @type {HTMLInputElement} 設定の行高さ設定欄 */
  const lineHeightInput = document.getElementById('config-line-height')

  lineHeightInput.addEventListener('change', ev => {
    onLineHeightInputChanged()
  })

  function onLineHeightInputChanged() {
    if (setCaptionLineHeight(Number(lineHeightInput.value))) {
      screenToConfig()
    }
  }

  /** @type {HTMLButtonElement} 設定の行高さ縮小ボタン */
  const lineHeightDecrement = document.getElementById('config-line-height-decrement')

  lineHeightDecrement.addEventListener('click', ev => {
    const lineHeight = Number(lineHeightInput.value)
    const newHeight = Math.max(Math.ceil(lineHeight/5)*5-5 , LINE_HEIGHT_MIN)
    if (lineHeight !== newHeight) {
      lineHeightInput.value = newHeight.toString()
      onLineHeightInputChanged()
    }
  })

  /** @type {HTMLButtonElement} 設定の行高さ拡大ボタン */
  const lineHeightIncrement = document.getElementById('config-line-height-increment')

  lineHeightIncrement.addEventListener('click', ev => {
    const lineHeight = Number(lineHeightInput.value)
    const newHeight = Math.min(Math.floor(lineHeight/5)*5+5 , LINE_HEIGHT_MAX)
    if (lineHeight !== newHeight) {
      lineHeightInput.value = newHeight.toString()
      onLineHeightInputChanged()
    }
  })

  // 字幕表示位置選択ラジオボタンへのイベント設定
  document.getElementsByName('position').forEach(el => {
    el.addEventListener('change', ev => {
      if (ev.target.value !== config.position) {
        setLayout(ev.target.value)
        config.position = ev.target.value
        screenToConfig()
      }
    })
  })

  /**
   * 字幕表示位置選択ラジオボタンの値の選択
   * @param {'bottom' | 'top' | 'left' | 'right'} position 
   */
  function setPositionRadioButton(position) {
    document.getElementsByName('position').forEach(el => {
      if (el.value === position) {
        el.checked = true
      }
    })
  }

  /** @type {HTMLButtonElement} 字幕ダウンロードボタン */
  const downloadCaptionButton = document.getElementById('config-download-captions')
  downloadCaptionButton.addEventListener('click', ev => {
    const timestamp = new Date()
    const timestampText = timestamp.toISOString()
      .replaceAll('T','_').replaceAll('Z','')
      .replaceAll(':','').replaceAll('-','')
      .substring(0,15)
    const log = speechLog.getWholeLog()
    const blob = new Blob(log, {type: 'text/plain'})
    const link = document.createElement('a')
    link.download = `captioncam_${timestampText}.txt`
    link.href = URL.createObjectURL(blob)
    link.click()
    URL.revokeObjectURL(link.href)
  })

  /** @type {HTMLButtonElement} 動作ログのダウンロードボタン */
  const downloadOpLogButton = document.getElementById('config-download-oplog')
  downloadOpLogButton.addEventListener('click', ev => {
    const timestamp = new Date()
    const timestampText = timestamp.toISOString()
      .replaceAll('T','_').replaceAll('Z','')
      .replaceAll(':','').replaceAll('-','')
      .substring(0,15)
    const blob = new Blob(logMessages, {type: 'text/plain'})
    const link = document.createElement('a')
    link.download = `captioncam_op_${timestampText}.txt`
    link.href = URL.createObjectURL(blob)
    link.click()
    URL.revokeObjectURL(link.href)
  })

  // ========== ========== 字幕表示 ========== ==========

  /**
   * 字幕を更新する。
   * @param {string} caption 現在の字幕
   */
  function updateCaption(caption) {
    captionArea.textContent = caption
  }

  // ========== ========== 音声認識関連オブジェクト ========== ==========

  let clearCaptionTimerId = -1
  const CLEAR_CAPTION_TIMER_MSEC = 10000
  const speechLog = new SpeechLog((message) => { log(message) })
  const recognizerOptions = new SpeechRecognizerOptions()
  recognizerOptions.speechLog = speechLog
  recognizerOptions.onLog = (message) => { log(message) }
  recognizerOptions.onCritical = (message) => {
    alert(`音声認識で重大なエラー（${message}）が発生しました。音声認識対応ブラウザ（PCならChromeやEdge）をご利用ください。`)
  }
  recognizerOptions.onUpdated = (text) => {
    updateCaption(text)
    setClearCaptionTimer()
  }
  const speechRecognizer = new SpeechRecognizer(recognizerOptions)

  function setClearCaptionTimer() {
    if (clearCaptionTimerId >= 0) {
      clearTimeout(clearCaptionTimerId)
    }
    clearCaptionTimerId = setTimeout(() => {
      updateCaption('')
      speechLog.reset()
    } , CLEAR_CAPTION_TIMER_MSEC)
  }

  /**
   * 音声認識を準備する。
   */
  function prepareSpeechRecognition() {
    speechRecognizer.init()
  }

  /**
   * 音声認識を開始する。
   * WebView2ではカメラ初期化前に音声認識を行うとエラーになるため、タイミング遅延用に独立関数とした。
   */
  function startSpeechRecognition() {
    updateCaption('') // 最初は待機中という旨が表示されているのでクリア
    speechRecognizer.start()
    // window.setTimeout(() => {
    //   updateCaption('') // 最初は待機中という旨が表示されているのでクリア
    //   speechRecognizer.start()
    // } , 10)
  }

  // ========== ========== カメラ関連 ========== ==========

  /**
   * カメラ一覧（select要素）の項目をクリアする。
   */
  function clearCameraList() {
    while(cameraList.firstChild) {
      cameraList.removeChild(cameraList.firstChild)
    }
  }

  /**
   * カメラ一覧（select要素）のうち、引数に合致するものがあれば、それを選択する。
   * @param {string} deviceId
   * @return {boolean} trueなら引数のカメラが存在し、選ばれている。
   */
  function selectCameraIfExists(deviceId) {
    if (deviceId == null) return false
    let result = false
    cameraList.childNodes.forEach(n => {
      if (n.value === deviceId) {
        cameraList.value = deviceId
        result = true
      }
    })
    return result
  }

  /**
   * 引数に基づいてカメラ一覧（select要素）を更新する。
   * もし直前に選択された項目があり、なおかつ更新後も当該項目が存在する場合、
   * 更新後もその項目を選択する。
   * @param {Array<MediaDeviceInfo>} deviceInfoList 
   * @return {number} 見つかったカメラの数
   */
  function updateCameraList(deviceInfoList) {
    const currentCamera = cameraList.value
    clearCameraList()
    for (let info of deviceInfoList) {
      if (info.kind !== 'videoinput') { continue }
      const option = document.createElement('option')
      option.value = info.deviceId
      option.text = info.label || `camera id=${info.deviceId}`
      cameraList.appendChild(option)
    }
    selectCameraIfExists(currentCamera)
    return cameraList.childElementCount
  }

  /**
   * もし映像（カメラプレビュー）が再生中であれば停止する。
   */
  function stopAllVideos() {
    if (cameraArea.srcObject != null) {
      cameraArea.srcObject.getTracks().forEach(track => {
        track.stop()
      })
    }
  }

  /**
   * カメラを取得し、プレビュー表示要素に当てはめるとともに、カメラ一覧を更新する。
   */
  async function setupCamera() {
    stopAllVideos()

    const constraints = {
      audio: false,
      video: {
        facingMode: 'user'
      }
    }

    const currentCamera = cameraList.value
    // 理由は不明だが、iOS/SafaritとAndroid/Chromeで、縦長時にwidth,heightを指定すると、縦横の寸法が逆の映像になってしまう。
    const wholeWidth = screen.width
    const wholeHeight = screen.height
    if (wholeWidth > wholeHeight) {
      constraints.video['width'] = { ideal: wholeWidth }
      constraints.video['height'] = { ideal: wholeHeight }
    }
    if (currentCamera != null && currentCamera !== '') {
      constraints.video['deviceId'] = { exact : currentCamera }
    }
    log(`Constraints : ${JSON.stringify(constraints)}`)

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      const devices = await navigator.mediaDevices.enumerateDevices()
      log(`got devices : ${JSON.stringify(devices)}`)
      const nCam = updateCameraList(devices)
      if (nCam < 1) {
        // カメラがなかった場合（例外になるような気もする）
        errorOnCameraSetup('カメラが存在しないようです。音声認識は別途試みます。')
      }
      cameraArea.srcObject = stream
    } catch(err) {
      log(`error in getUserMedia. info=${err}`)
      errorOnCameraSetup(`カメラ初期化でエラーが発生しました（${err}）。\n音声認識は別途試みます。`)
    }
  }

  /**
   * カメラ初期化が失敗した場合の処理（エラーメッセージの表示と初期化後処理）
   * @param {string} message 表示するエラーメッセージ
   */
  function errorOnCameraSetup(message) {
    alert(message)
    doPostCameraSetup()
  }

  // ========== ========== PWA関連 ========== ==========

  /**
   * PWA用にService Workerを設定する。
   */
  function setupServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
        .then((registration) => {
          console.log(`[Main] ServiceWorker registration finished. Scope:${registration.scope}`);
        })
        .catch((reason) => {
          console.log(`[Main] ServiceWorker registratio failed. Reason:${reason}`);
        });
      });
    }
  }

  // ========== ========== 処理開始 ========== ==========

  /**
   * カメラ初期化の完了後に行うべき処理
   * （ここでは音声認識開始としている。WebView2ではカメラ初期化完了前に開始すると失敗になるため）
   */
  function doPostCameraSetup() {
    prepareSpeechRecognition()
    log(`speech recognition wait : ${WAIT_SPEECH_RECOGNITION}[msec]`)
    window.setTimeout(() => {
      startSpeechRecognition()
    }, WAIT_SPEECH_RECOGNITION)
  }

  log(`User Agent : ${navigator.userAgent}`)
  setupServiceWorker()
  configToScreen()
  setupCamera()
})
