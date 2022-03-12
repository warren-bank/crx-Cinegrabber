// ==UserScript==
// @name         Cinegrabber
// @description  Watch videos in external player.
// @version      1.0.1
// @match        *://cinegrabber.com/v/*
// @match        *://*.cinegrabber.com/v/*
// @icon         https://cinegrabber.com/asset/default/img/favicon.ico
// @run-at       document-end
// @grant        unsafeWindow
// @homepage     https://github.com/warren-bank/crx-Cinegrabber/tree/webmonkey-userscript/es5
// @supportURL   https://github.com/warren-bank/crx-Cinegrabber/issues
// @downloadURL  https://github.com/warren-bank/crx-Cinegrabber/raw/webmonkey-userscript/es5/webmonkey-userscript/Cinegrabber.user.js
// @updateURL    https://github.com/warren-bank/crx-Cinegrabber/raw/webmonkey-userscript/es5/webmonkey-userscript/Cinegrabber.user.js
// @namespace    warren-bank
// @author       Warren Bank
// @copyright    Warren Bank
// ==/UserScript==

// ----------------------------------------------------------------------------- constants

var user_options = {
  "common": {
    "resolve_media_urls":           true,  // requires Chrome 37+
    "filters": {
      "streams": {
        "max_resolution":           "720p"
      },
      "subtitles": {
        "language":                 "English"
      }
    }
  },
  "webmonkey": {
    "post_intent_redirect_to_url":  "about:blank"
  },
  "greasemonkey": {
    "redirect_to_webcast_reloaded": true,
    "force_http":                   true,
    "force_https":                  false
  }
}

// ----------------------------------------------------------------------------- helpers (xhr)

var serialize_xhr_body_object = function(data) {
  if (typeof data === 'string')
    return data

  if (!(data instanceof Object))
    return null

  var body = []
  var keys = Object.keys(data)
  var key, val
  for (var i=0; i < keys.length; i++) {
    key = keys[i]
    val = data[key]
    val = unsafeWindow.encodeURIComponent(val)

    body.push(key + '=' + val)
  }
  body = body.join('&')
  return body
}

var download_text = function(url, headers, data, callback) {
  if (data) {
    if (!headers)
      headers = {}
    if (!headers['content-type'])
      headers['content-type'] = 'application/x-www-form-urlencoded'

    switch(headers['content-type'].toLowerCase()) {
      case 'application/json':
        data = JSON.stringify(data)
        break

      case 'application/x-www-form-urlencoded':
      default:
        data = serialize_xhr_body_object(data)
        break
    }
  }

  var xhr    = new unsafeWindow.XMLHttpRequest()
  var method = data ? 'POST' : 'GET'

  xhr.open(method, url, true, null, null)

  if (headers && (typeof headers === 'object')) {
    var keys = Object.keys(headers)
    var key, val
    for (var i=0; i < keys.length; i++) {
      key = keys[i]
      val = headers[key]
      xhr.setRequestHeader(key, val)
    }
  }

  xhr.onload = function(e) {
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        callback(xhr.responseText)
      }
    }
  }

  if (data)
    xhr.send(data)
  else
    xhr.send()
}

var download_json = function(url, headers, data, callback) {
  if (!headers)
    headers = {}
  if (!headers.accept)
    headers.accept = 'application/json'

  download_text(url, headers, data, function(text){
    try {
      callback(JSON.parse(text))
    }
    catch(e) {}
  })
}

// ----------------------------------------------------------------------------- helpers (xhr: 3xx redirect)

var resolve_redirected_url = function(url, callback) {
  if (!url || ('string' !== (typeof url)))
    return callback(null)

  if (!user_options.common.resolve_media_urls)
    return callback(url)

  var xhr = new XMLHttpRequest()
  xhr.open('GET', url, true)
  xhr.onprogress = function() {
    if ((xhr.status >= 200) && (xhr.status < 300)) {
      callback(
        (xhr.responseURL && (xhr.responseURL !== url)) ? xhr.responseURL : url
      )
      xhr.abort()
    }
  }
  xhr.send()
}

// ----------------------------------------------------------------------------- URL links to tools on Webcast Reloaded website

var get_webcast_reloaded_url = function(video_url, caption_url, referer_url, force_http, force_https) {
  force_http  = (typeof force_http  === 'boolean') ? force_http  : user_options.greasemonkey.force_http
  force_https = (typeof force_https === 'boolean') ? force_https : user_options.greasemonkey.force_https

  var encoded_video_url, encoded_caption_url, encoded_referer_url, webcast_reloaded_base, webcast_reloaded_url

  encoded_video_url     = encodeURIComponent(encodeURIComponent(btoa(video_url)))
  encoded_caption_url   = caption_url ? encodeURIComponent(encodeURIComponent(btoa(caption_url))) : null
  referer_url           = referer_url ? referer_url : unsafeWindow.location.href
  encoded_referer_url   = encodeURIComponent(encodeURIComponent(btoa(referer_url)))

  webcast_reloaded_base = {
    "https": "https://warren-bank.github.io/crx-webcast-reloaded/external_website/index.html",
    "http":  "http://webcast-reloaded.surge.sh/index.html"
  }

  webcast_reloaded_base = (force_http)
                            ? webcast_reloaded_base.http
                            : (force_https)
                               ? webcast_reloaded_base.https
                               : (video_url.toLowerCase().indexOf('http:') === 0)
                                  ? webcast_reloaded_base.http
                                  : webcast_reloaded_base.https

  webcast_reloaded_url  = webcast_reloaded_base + '#/watch/' + encoded_video_url + (encoded_caption_url ? ('/subtitle/' + encoded_caption_url) : '') + '/referer/' + encoded_referer_url
  return webcast_reloaded_url
}

// ----------------------------------------------------------------------------- URL redirect

var determine_video_type = function(video_url) {
  if (!video_url) return null

  var video_url_regex_pattern = /^.*\.(mp4|mp4v|mpv|m1v|m4v|mpg|mpg2|mpeg|xvid|webm|3gp|avi|mov|mkv|ogv|ogm|m3u8|mpd|ism(?:[vc]|\/manifest)?)(?:[\?#].*)?$/i
  var matches, file_ext, video_type

  matches = video_url_regex_pattern.exec(video_url)

  if (matches && matches.length)
    file_ext = matches[1]

  if (file_ext) {
    switch (file_ext) {
      case "mp4":
      case "mp4v":
      case "m4v":
        video_type = "video/mp4"
        break
      case "mpv":
        video_type = "video/MPV"
        break
      case "m1v":
      case "mpg":
      case "mpg2":
      case "mpeg":
        video_type = "video/mpeg"
        break
      case "xvid":
        video_type = "video/x-xvid"
        break
      case "webm":
        video_type = "video/webm"
        break
      case "3gp":
        video_type = "video/3gpp"
        break
      case "avi":
        video_type = "video/x-msvideo"
        break
      case "mov":
        video_type = "video/quicktime"
        break
      case "mkv":
        video_type = "video/x-mkv"
        break
      case "ogg":
      case "ogv":
      case "ogm":
        video_type = "video/ogg"
        break
      case "m3u8":
        video_type = "application/x-mpegURL"
        break
      case "mpd":
        video_type = "application/dash+xml"
        break
      case "ism":
      case "ism/manifest":
      case "ismv":
      case "ismc":
        video_type = "application/vnd.ms-sstr+xml"
        break
    }
  }

  return video_type ? video_type.toLowerCase() : ""
}

var redirect_to_url = function(url) {
  if (!url) return

  if (typeof GM_loadUrl === 'function') {
    if (typeof GM_resolveUrl === 'function')
      url = GM_resolveUrl(url, unsafeWindow.location.href) || url

    GM_loadUrl(url, 'Referer', unsafeWindow.location.href)
  }
  else {
    try {
      unsafeWindow.top.location = url
    }
    catch(e) {
      unsafeWindow.window.location = url
    }
  }
}

var process_webmonkey_post_intent_redirect_to_url = function() {
  var url = null

  if (typeof user_options.webmonkey.post_intent_redirect_to_url === 'string')
    url = user_options.webmonkey.post_intent_redirect_to_url

  if (typeof user_options.webmonkey.post_intent_redirect_to_url === 'function')
    url = user_options.webmonkey.post_intent_redirect_to_url()

  if (typeof url === 'string')
    redirect_to_url(url)
}

var process_video_data = function(data) {
  if (!data.video_url) return

  if (!data.referer_url)
    data.referer_url = unsafeWindow.location.href

  if (typeof GM_startIntent === 'function') {
    // running in Android-WebMonkey: open Intent chooser

    if (!data.video_type)
      data.video_type = determine_video_type(data.video_url)

    var args = [
      /* action = */ 'android.intent.action.VIEW',
      /* data   = */ data.video_url,
      /* type   = */ data.video_type
    ]

    // extras:
    if (data.caption_url) {
      args.push('textUrl')
      args.push(data.caption_url)
    }
    if (data.referer_url) {
      args.push('referUrl')
      args.push(data.referer_url)
    }
    if (data.drm.scheme) {
      args.push('drmScheme')
      args.push(data.drm.scheme)
    }
    if (data.drm.server) {
      args.push('drmUrl')
      args.push(data.drm.server)
    }
    if (data.drm.headers && (typeof data.drm.headers === 'object')) {
      var drm_header_keys, drm_header_key, drm_header_val

      drm_header_keys = Object.keys(data.drm.headers)
      for (var i=0; i < drm_header_keys.length; i++) {
        drm_header_key = drm_header_keys[i]
        drm_header_val = data.drm.headers[drm_header_key]

        args.push('drmHeader')
        args.push(drm_header_key + ': ' + drm_header_val)
      }
    }

    GM_startIntent.apply(this, args)
    process_webmonkey_post_intent_redirect_to_url()
    return true
  }
  else if (user_options.greasemonkey.redirect_to_webcast_reloaded) {
    // running in standard web browser: redirect URL to top-level tool on Webcast Reloaded website

    redirect_to_url(get_webcast_reloaded_url(data.video_url, data.caption_url, data.referer_url))
    return true
  }
  else {
    return false
  }
}

// -------------------------------------

var process_hls_data = function(data) {
  data.video_type = 'application/x-mpegurl'
  process_video_data(data)
}

var process_dash_data = function(data) {
  data.video_type = 'application/dash+xml'
  process_video_data(data)
}

var process_mp4_data = function(data) {
  data.video_type = 'video/mp4'
  process_video_data(data)
}

// -------------------------------------

var process_video_url = function(video_url, video_type, caption_url, referer_url) {
  var data = {
    drm: {
      scheme:    null,
      server:    null,
      headers:   null
    },
    video_url:   video_url   || null,
    video_type:  video_type  || null,
    caption_url: caption_url || null,
    referer_url: referer_url || null
  }

  process_video_data(data)
}

var process_hls_url = function(video_url, caption_url, referer_url) {
  process_video_url(video_url, /* video_type= */ 'application/x-mpegurl', caption_url, referer_url)
}

var process_dash_url = function(video_url, caption_url, referer_url) {
  process_video_url(video_url, /* video_type= */ 'application/dash+xml', caption_url, referer_url)
}

var process_mp4_url = function(video_url, caption_url, referer_url) {
  process_video_url(video_url, /* video_type= */ 'video/mp4', caption_url, referer_url)
}

// ----------------------------------------------------------------------------- download video URL

var process_video = function(user_id, video_id) {
  download_video_url(user_id, video_id, process_video_url)
}

// -------------------------------------

/*
 * ======
 * notes:
 * ======
 * - callback is passed 3x String parameters:
 *   * video_url
 *   * video_type
 *   * caption_url
 */

var download_video_url = function(user_id, video_id, callback) {
  if (!user_id || !video_id || !callback || (typeof callback !== 'function'))
    return

  var loc = unsafeWindow.location
  var url, headers, data, json_callback

  url     = loc.protocol + '//' + loc.host + '/api/source/' + video_id
  headers = null
  data    = {d: "cinegrabber.com", r: ""}

  json_callback = function(json) {
    if (!json || !(json instanceof Object) || !json.success) return

    var data, video_url, video_type, caption_url

    data = get_best_video(user_id, video_id, json)
    if (!data) return
    video_url  = resolve_url(data.video_url)
    video_type = data.video_type

    data = get_best_caption(user_id, video_id, json)
    caption_url = data ? resolve_url(data.caption_url) : null

    resolve_redirected_url(video_url, function(resolved_video_url) {
      callback(resolved_video_url, video_type, caption_url)
    })
  }

  download_json(url, headers, data, json_callback)
}

/*
 * ======
 * debug:
 * ======
  download_video_url('224879', 'qy04eae514-z75w', console.log)
 */

// -------------------------------------

var get_best_video = function(user_id, video_id, json) {
  if (!Array.isArray(json.data) || !json.data.length) return null

  var metadata, max
  var video, video_url, video_type

  metadata = json.data.map(function(val) {
    if (!val || !(val instanceof Object) || !val.file) return null

    var resolution = parseInt(val.label, 10)
    if (isNaN(resolution))
      resolution = 0

    return {
      url:        val.file,
      type:       val.type,
      resolution: resolution
    }
  })

  metadata = metadata.filter(function(val) {return !!val})

  if (!metadata.length) return null

  metadata.sort(function(val1, val2) { // descending order
    return (val1.resolution > val2.resolution)
      ? -1
      : (val1.resolution < val2.resolution)
        ? 1
        : 0
  })

  max = parseInt(user_options.common.filters.streams.max_resolution, 10)

  if (!video && max && !isNaN(max)) {
    video = metadata.filter(function(val) {
      return val === max
    })

    video = video.length ? video[0] : null
  }

  if (!video && (!max || isNaN(max))) {
    // no preference; default to highest available resolution
    video = metadata[0]
  }

  if (!video && max && !isNaN(max)) {
    for (var i=0; i < metadata.length; i++) {
      if (metadata[i].resolution <= max) {
        // highest resolution that satisfies criteria
        video = metadata[i]
        break
      }
    }
  }

  if (!video) {
    // no resolution satisfies criteria; default to lowest available resolution
    video = metadata[metadata.length - 1]
  }

  video_url = video.url

  if (video.type) {
    switch(video.type.toLowerCase()) {
      case 'mp4':
        video_url += '#video.' + video.type
        break
      case 'hls':
        video_url += '#video.m3u8'
        break
      case 'dash':
        video_url += '#video.mpd'
        break
    }

    video_type = determine_video_type(video_url)
  }

  return {video_url: video_url, video_type: video_type}
}

// -------------------------------------

var get_best_caption = function(user_id, video_id, json) {
  if (!Array.isArray(json.captions) || !json.captions.length) return null

  var lang, sub, caption_url

  lang = user_options.common.filters.subtitles.language
  if (!lang) return null
  lang = lang.toLowerCase()

  for (var i=0; i < json.captions.length; i++) {
    sub = json.captions[i]

    if (sub && (sub instanceof Object) && (typeof sub.language === 'string') && (sub.language.toLowerCase() === lang) && sub.id) {
      caption_url = 'https://cinegrabber.com/asset/userdata/' + user_id + '/caption/' + (sub.hash || video_id) + '/' + sub.id + '.' + (sub.extension || 'srt')
      return {caption_url: caption_url}
    }
  }

  return null
}

// -------------------------------------

var resolve_url = function(url) {
  if (!url || (typeof url !== 'string'))
    return url

  if (url.substring(0, 4).toLowerCase() === 'http')
    return url

  if (url.substring(0, 2) === '//')
    return unsafeWindow.location.protocol + url

  if (url.substring(0, 1) === '/')
    return unsafeWindow.location.protocol + '//' + unsafeWindow.location.host + url

  return unsafeWindow.location.protocol + '//' + unsafeWindow.location.host + unsafeWindow.location.pathname.replace(/[^\/]+$/, '') + url
}

// ----------------------------------------------------------------------------- bootstrap

var init = function() {
  var path           = unsafeWindow.location.pathname
  var video_id_regex = new RegExp('^/v/([^/\\?]+).*$')
  var user_id, video_id

  user_id = get_user_id()
  if (!user_id || !video_id_regex.test(path)) return
  video_id = path.replace(video_id_regex, '$1')

  process_video(user_id, video_id)
}

var get_user_id = function() {
  if (unsafeWindow.USER_ID)
    return unsafeWindow.USER_ID

  var regex = {
    whitespace: /[\r\n\t]+/g,
    user_id:    /^.*var USER_ID\s*=\s*['"]([^'"]+)['"].*$/
  }
  var scripts, script, match

  scripts = unsafeWindow.document.querySelectorAll('script:not([src])')
  for (var i=0; i < scripts.length; i++) {
    script = scripts[i]
    script = script.innerText.trim()
    script = script.replace(regex.whitespace, ' ')
    match  = regex.user_id.exec(script)

    if (match)
      return match[1]
  }

  return null
}

var should_init = function() {
  if ((typeof GM_getUrl === 'function') && (GM_getUrl() !== unsafeWindow.location.href)) return false

  return true
}

if (should_init())
  init()
