/* @refresh reload */
import { render } from 'solid-js/web'
import { Show, onMount, For, createEffect, createSignal, createResource } from 'solid-js'
import Hls from 'hls.js'
import WFPlayer from 'wfplayer'
import './index.css'

if (Hls.isSupported()) {
  render(() => <App />, document.getElementById('root'));
} else {
  render(() => <AppDontWork />, document.getElementById('root'));
}

const getTimeFloatFormatted = (float) => {
  return Math.trunc(float / 60).toString() + ":" + ("0" + Math.trunc(float % 60).toString()).slice(-2)
}

async function fetchPlaylists() {
  const playlists = (await fetch('https://runebound.spellforce.info/public/sos/music/playlists.json')).json();
  return playlists;
}

function AppDontWork() {
  return (
    <div class="w-screen h-screen flex justify-center items-center text-white bg-red-600">
      Your browser doesn't support HLS streaming
    </div>
  )
}

function App() {
  let audio
  let waveform

  const [hls, setHls] = createSignal(undefined) 
  const [playing, setPlaying] = createSignal(false)
  const [currentlyPlaying, setCurrentlyPlaying] = createSignal(undefined)
  const [selectedBitrate, setSelectedBitrate] = createSignal(128000)
  const [volume, setVolume] = createSignal(undefined)
  const [playlists, {mutate: mutatePlaylists}] = createResource(fetchPlaylists)
  const [playbackTime, setPlaybackTime] = createSignal({ current: -1, currentFormatted: "", duration: -1, durationFormatted: "" })

  createEffect(() => {
    const playlists2 = playlists()
    if (playlists2 == undefined) return
    const playlistsSorted = playlists2.sort((a, b) => a.title.localeCompare(b.title))
    mutatePlaylists(playlistsSorted)
  })

  onMount(() => {
    const volumeString = localStorage.getItem('volume') || '0.25'
    const volume = parseFloat(volumeString)
    setVolume(volume)
 
    window.onkeydown = (event) => {
      const keyCodeIsNotWhitespace = event.keyCode != 32
      if (keyCodeIsNotWhitespace) return true

      event.preventDefault()
      togglePlay()

      return false
    }

    audio.volume = volume
    audio.addEventListener('ended', () => nextSong())
    audio.addEventListener('timeupdate', () => {
      setPlaybackTime({
        current: audio.currentTime,
        currentFormatted: getTimeFloatFormatted(audio.currentTime),
        duration: audio.duration,
        durationFormatted: getTimeFloatFormatted(audio.duration),
      })
    })
  })

  const seek = (event) => {
    if (!hls()) return
    const audioDuration = audio.duration
    const audioDurationAlongProgress = (event.clientX - waveform.offsetLeft) / waveform.offsetWidth
    audio.currentTime = audioDuration * audioDurationAlongProgress
  }

  const togglePlay = () => {
    if (!hls()) return
    if (audio.paused) {
      audio.play()
    } else {
      audio.pause()
    }
    setPlaying(audio.paused)
  }

  const changeVolume = (event) => {
    const volume = parseFloat(event.currentTarget.value)
    audio.volume = volume
    setVolume(volume)
    localStorage.setItem('volume', volume)
  }

  const changeBitrate = (event) => {
    setSelectedBitrate(event.currentTarget.value)
  }

  const previousSong = () => {
    const previousPlaylistIndex = playlists().findIndex(playlist => playlist.title === currentlyPlaying().title) - 1
    const previousPlaylist = playlists()[previousPlaylistIndex]
    if (!previousPlaylist) return
    playSong(previousPlaylist)
  }

  const nextSong = () => {
    const nextPlaylistIndex = playlists().findIndex(playlist => playlist.title === currentlyPlaying().title) + 1
    const nextPlaylist = playlists()[nextPlaylistIndex]
    if (!nextPlaylist) return
    playSong(nextPlaylist)
  }

  const playSong = (playlist) => {
    const streamUrl = 'https://runebound.spellforce.info' + playlist.stream

    if (hls()) {
      hls().destroy()
    }

    setHls(new Hls()) 
    console.log('created new hls player instance')

    hls().loadSource(streamUrl)
    console.log(`loaded hls playlist from ${streamUrl}`)

    hls().attachMedia(audio)
    console.log('attached hls player instance to dom audio element')

    hls().on(Hls.Events.MANIFEST_PARSED, (event, data) => {
      console.log('parsed hls playlist manifest')
      console.log('available bitrates', data.levels.map(level => level.bitrate))

      const matchingLevel = data.levels.findIndex(level => level.bitrate === selectedBitrate());
      hls().currentLevel = matchingLevel !== -1 ? matchingLevel : data.levels.length - 1;

      togglePlay()
      setCurrentlyPlaying(playlist)
    })
  }
  return (
    <div class="font-[IBM_Plex_Sans] bg-white text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200">
      <audio ref={audio}></audio>
      <div class="flex flex-col items-center h-screen">
        <div class="flex-1 overflow-scroll grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 w-full p-8">
          <For each={playlists()}>
            {(playlist, index) => (
              <div onClick={[playSong, playlist]} class="bg-gray-50 flex flex-1 justify-between px-5 cursor-pointer py-3 rounded hover:bg-gray-100">
                <div class="flex gap-8 items-center">
                  <span class="whitespace-nowrap">{playlist.title}</span>
                </div>
                <div class="flex items-center">
                  <a href={"https://runebound.spellforce.info" + playlist.original} download={playlist.title + ".mp3"} class="flex items-center transform scale-80 justify-center w-10 h-10 hover:bg-gray-200 hover:cursor-pointer rounded">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-download"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                  </a>
                </div>
              </div>
            )}
          </For>
        </div>
        <div class="basis-20 w-full px-8 flex items-center justify-between gap-8 left-0 bottom-0 bg-gray-100">
          <div class="flex items-center gap-2">
            <svg onClick={[previousSong]} class={`scale-90 ${hls() == undefined ? "opacity-50" : "opacity-100 hover:cursor-pointer "}`} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-skip-back"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" x2="5" y1="19" y2="5"/></svg>
            <Switch>
              <Match when={playing()}>
                <svg onClick={[togglePlay]} class={`${hls() == undefined ? "opacity-50" : "opacity-100 hover:cursor-pointer"}`} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-play"><polygon points="6 3 20 12 6 21 6 3"/></svg>
              </Match>
              <Match when={!playing()}>
                <svg onClick={[togglePlay]} class={`${hls() == undefined ? "opacity-50" : "opacity-100 hover:cursor-pointer"}`} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-pause"><rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/></svg>
              </Match>
            </Switch>
            <svg onClick={[nextSong]} class={`scale-90 ${hls() == undefined ? "opacity-50" : "opacity-100 hover:cursor-pointer "}`} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-skip-forward"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" x2="19" y1="5" y2="19"/></svg>
          </div>
          <div class="flex flex-col">
            <Switch>
              <Match when={!currentlyPlaying()}>
                <span class="font-medium transform -skew-x-5 text-gray-600 text-lg">
                  No song playing
                </span>
              </Match>
              <Match when={currentlyPlaying()}>
                <span class="font-medium text-lg">
                  {currentlyPlaying().title}
                </span>
              </Match>
            </Switch>
            <div class="text-sm font-medium text-gray-500">
              <span>{playbackTime().currentFormatted}</span>
              {playbackTime().current != -1 && <>&nbsp; / &nbsp;</>} 
              <span>{playbackTime().durationFormatted}</span>
            </div>
          </div>
          <div onClick={[seek]} ref={waveform} class="flex-1 h-full flex items-center relative">
            {currentlyPlaying() && <img class="absolute left-0 w-full h-full opacity-10" src={'https://runebound.spellforce.info' + currentlyPlaying().waveform}/>}
            {currentlyPlaying() && <img class="absolute left-0 w-full h-full" style={`clip-path: inset(0% ${100 - (100 * (playbackTime().current / playbackTime().duration))}% 0% 0%);`} src={'https://runebound.spellforce.info' + currentlyPlaying().waveform}/>}
            {/*
            <progress onClick={[seek]} ref={progress} class="w-full" value={playbackTime().current} max={playbackTime().duration}>
            </progress>
            */}
          </div>
          <div class="flex flex-col justify-center gap-1">
            <label class="text-sm font-medium text-gray-500">Volume</label>
            <input onInput={[changeVolume]} type="range" step="0.01" min="0" max="1" value={volume()} />
          </div>
          <div class="flex flex-col">
            <label class="text-sm font-medium text-gray-500">Select Bitrate:</label>
            <select onChange={(e) => setSelectedBitrate(parseInt(e.currentTarget.value))}>
              <option value="64000">64 kbps (Low)</option>
              <option value="128000" selected>128 kbps (Medium)</option>
              <option value="192000">192 kbps (High)</option>
              <option value="320000">320 kbps (Full)</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}
