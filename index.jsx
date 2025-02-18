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
  return (await fetch('https://runebound.spellforce.info/public/sos/music/playlists.json')).json();
}

function AppDontWork() {
  return (
    <div class="w-screen h-screen flex justify-center items-center text-white bg-red-600">
      Your browser doesn't support HLS streaming
    </div>
  )
}

function AppLoading() {
  return (
    <div class="w-screen h-screen flex justify-center items-center text-white bg-red-600">
      Just a second
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
  const [playlists] = createResource(fetchPlaylists)
  const [playbackTime, setPlaybackTime] = createSignal({ current: -1, currentFormatted: "", duration: -1, durationFormatted: "" })

  onMount(() => {
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
      <Show when={!playlists.loading} fallback={<AppLoading/>}>
        <div class="flex flex-col items-center h-screen">
          <div class="flex-1 overflow-scroll flex flex-col gap-4 w-full p-8">
            <For each={playlists()}>
              {(playlist, index) => (
                <div class="bg-gray-50 flex justify-between px-10 py-5 rounded-xl">
                  <div class="flex gap-8 items-center">
                    <div onClick={[playSong, playlist]} class="w-10 h-10 rounded text-gray-600 hover:text-red-600 hover:cursor-pointer inline-flex items-center justify-center bg-gray-200">
                      <svg class="hover:cursor-pointer" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-play"><polygon points="6 3 20 12 6 21 6 3"/></svg>
                    </div>
                    <div class="flex flex-col gap-2">
                      <span>{playlist.title}</span>
                      <div class="flex items-center gap-2">
                        <For each={playlist.maps}>
                          {(map, index) => (
                            <span class="px-2 rounded py-1 text-xs bg-gray-200">
                              {map}
                            </span>
                          )}
                        </For>
                      </div>
                    </div>
                  </div>
                  <div>
                    <a href={"https://runebound.spellforce.info" + playlist.original} download={playlist.title + ".mp3"} class="flex items-center justify-center w-10 h-10 hover:bg-gray-200 hover:cursor-pointer rounded">
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
                    No song selected
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
                &nbsp; / &nbsp; 
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
      </Show>
    </div>
  )
}
