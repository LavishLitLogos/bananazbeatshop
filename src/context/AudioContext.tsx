import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Beat, BeatTapeTrack, ProdBySong } from '../types';

type PlayableItem = Beat | ProdBySong | BeatTapeTrack;

interface AudioPlayerState {
  currentBeat: PlayableItem | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  previewOnly: boolean;
  previewSeconds: number;
  queue: PlayableItem[];
  queueIndex: number;
}

interface AudioContextType extends AudioPlayerState {
  play: (item: PlayableItem, previewOnly?: boolean, previewSeconds?: number) => void;
  playQueue: (
    items: PlayableItem[],
    startIndex?: number,
    previewOnly?: boolean,
    previewSeconds?: number
  ) => void;
  pause: () => void;
  resume: () => void;
  toggle: () => void;
  stop: () => void;
  seek: (time: number) => void;
  setVolume: (value: number) => void;
  next: () => void;
  prev: () => void;
  hasNext: boolean;
  hasPrev: boolean;
}

const AudioContext = createContext<AudioContextType | null>(null);

const DEFAULT_VOLUME = 0.8;
const DEFAULT_PREVIEW_SECONDS = 45;

function hasAudioFile(item: PlayableItem): item is PlayableItem & { audio_file_url: string } {
  return Boolean(item.audio_file_url);
}

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef<AudioPlayerState | null>(null);

  const [state, setState] = useState<AudioPlayerState>({
    currentBeat: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: DEFAULT_VOLUME,
    previewOnly: false,
    previewSeconds: DEFAULT_PREVIEW_SECONDS,
    queue: [],
    queueIndex: -1,
  });

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const clearPreviewTimer = useCallback(() => {
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
  }, []);

  const pauseAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
  }, []);

  const loadAndPlay = useCallback(
    (
      item: PlayableItem,
      queue: PlayableItem[],
      queueIndex: number,
      previewOnly = false,
      previewSeconds = DEFAULT_PREVIEW_SECONDS
    ) => {
      if (!hasAudioFile(item)) return;

      const audio = audioRef.current;
      if (!audio) return;

      clearPreviewTimer();

      audio.pause();
      audio.src = item.audio_file_url;
      audio.currentTime = 0;
      audio.volume = stateRef.current?.volume ?? DEFAULT_VOLUME;

      setState((current) => ({
        ...current,
        currentBeat: item,
        isPlaying: true,
        currentTime: 0,
        duration: 0,
        previewOnly,
        previewSeconds,
        queue,
        queueIndex,
      }));

      audio
        .play()
        .then(() => {
          if (!previewOnly) return;

          previewTimerRef.current = setTimeout(() => {
            const currentState = stateRef.current;
            const currentAudio = audioRef.current;

            if (!currentState || !currentAudio) return;

            const nextIndex = currentState.queueIndex + 1;
            const nextItem = currentState.queue[nextIndex];

            if (nextItem && hasAudioFile(nextItem)) {
              loadAndPlay(
                nextItem,
                currentState.queue,
                nextIndex,
                currentState.previewOnly,
                currentState.previewSeconds
              );
              return;
            }

            currentAudio.pause();
            currentAudio.currentTime = 0;

            setState((current) => ({
              ...current,
              isPlaying: false,
              currentTime: 0,
            }));
          }, previewSeconds * 1000);
        })
        .catch(() => {
          setState((current) => ({
            ...current,
            isPlaying: false,
          }));
        });
    },
    [clearPreviewTimer]
  );

  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.volume = DEFAULT_VOLUME;
    audioRef.current = audio;

    const onTimeUpdate = () => {
      setState((current) => ({
        ...current,
        currentTime: audio.currentTime,
      }));
    };

    const onLoadedMetadata = () => {
      setState((current) => ({
        ...current,
        duration: Number.isFinite(audio.duration) ? audio.duration : 0,
      }));
    };

    const onEnded = () => {
      clearPreviewTimer();

      const currentState = stateRef.current;
      if (!currentState) return;

      const nextIndex = currentState.queueIndex + 1;
      const nextItem = currentState.queue[nextIndex];

      if (nextItem && hasAudioFile(nextItem)) {
        loadAndPlay(
          nextItem,
          currentState.queue,
          nextIndex,
          currentState.previewOnly,
          currentState.previewSeconds
        );
        return;
      }

      setState((current) => ({
        ...current,
        isPlaying: false,
        currentTime: 0,
      }));
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);

    return () => {
      clearPreviewTimer();

      audio.pause();
      audio.removeAttribute('src');
      audio.load();

      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);

      audioRef.current = null;
    };
  }, [clearPreviewTimer, loadAndPlay]);

  const play = useCallback(
    (item: PlayableItem, previewOnly = false, previewSeconds = DEFAULT_PREVIEW_SECONDS) => {
      if (!hasAudioFile(item)) return;

      const currentState = stateRef.current;

      if (currentState?.currentBeat?.id === item.id && currentState.isPlaying) {
        pauseAudio();
        clearPreviewTimer();

        setState((current) => ({
          ...current,
          isPlaying: false,
        }));

        return;
      }

      loadAndPlay(item, [item], 0, previewOnly, previewSeconds);
    },
    [clearPreviewTimer, loadAndPlay, pauseAudio]
  );

  const playQueue = useCallback(
    (
      items: PlayableItem[],
      startIndex = 0,
      previewOnly = false,
      previewSeconds = DEFAULT_PREVIEW_SECONDS
    ) => {
      const cleanQueue = items.filter(hasAudioFile);
      const safeIndex = Math.max(0, Math.min(startIndex, cleanQueue.length - 1));
      const item = cleanQueue[safeIndex];

      if (!item) return;

      loadAndPlay(item, cleanQueue, safeIndex, previewOnly, previewSeconds);
    },
    [loadAndPlay]
  );

  const pause = useCallback(() => {
    pauseAudio();
    clearPreviewTimer();

    setState((current) => ({
      ...current,
      isPlaying: false,
    }));
  }, [clearPreviewTimer, pauseAudio]);

  const resume = useCallback(() => {
    const audio = audioRef.current;
    const currentState = stateRef.current;

    if (!audio || !currentState?.currentBeat) return;

    audio
      .play()
      .then(() => {
        setState((current) => ({
          ...current,
          isPlaying: true,
        }));

        if (!currentState.previewOnly) return;

        const remaining = Math.max(
          currentState.previewSeconds - currentState.currentTime,
          1
        );

        previewTimerRef.current = setTimeout(() => {
          const latest = stateRef.current;
          const currentAudio = audioRef.current;

          if (!latest || !currentAudio) return;

          const nextIndex = latest.queueIndex + 1;
          const nextItem = latest.queue[nextIndex];

          if (nextItem && hasAudioFile(nextItem)) {
            loadAndPlay(
              nextItem,
              latest.queue,
              nextIndex,
              latest.previewOnly,
              latest.previewSeconds
            );
            return;
          }

          currentAudio.pause();
          currentAudio.currentTime = 0;

          setState((current) => ({
            ...current,
            isPlaying: false,
            currentTime: 0,
          }));
        }, remaining * 1000);
      })
      .catch(() => {});
  }, [loadAndPlay]);

  const toggle = useCallback(() => {
    const currentState = stateRef.current;

    if (currentState?.isPlaying) {
      pause();
      return;
    }

    resume();
  }, [pause, resume]);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    clearPreviewTimer();

    audio.pause();
    audio.currentTime = 0;
    audio.removeAttribute('src');
    audio.load();

    setState((current) => ({
      ...current,
      currentBeat: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      previewOnly: false,
      queue: [],
      queueIndex: -1,
    }));
  }, [clearPreviewTimer]);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    const safeTime = Math.max(0, Math.min(time, audio.duration || time));
    audio.currentTime = safeTime;

    setState((current) => ({
      ...current,
      currentTime: safeTime,
    }));
  }, []);

  const setVolume = useCallback((value: number) => {
    const safeVolume = Math.max(0, Math.min(1, value));

    if (audioRef.current) {
      audioRef.current.volume = safeVolume;
    }

    setState((current) => ({
      ...current,
      volume: safeVolume,
    }));
  }, []);

  const next = useCallback(() => {
    const currentState = stateRef.current;
    if (!currentState) return;

    const nextIndex = currentState.queueIndex + 1;
    const item = currentState.queue[nextIndex];

    if (!item || !hasAudioFile(item)) return;

    loadAndPlay(
      item,
      currentState.queue,
      nextIndex,
      currentState.previewOnly,
      currentState.previewSeconds
    );
  }, [loadAndPlay]);

  const prev = useCallback(() => {
    const currentState = stateRef.current;
    if (!currentState) return;

    const previousIndex = currentState.queueIndex - 1;
    const item = currentState.queue[previousIndex];

    if (!item || !hasAudioFile(item)) return;

    loadAndPlay(
      item,
      currentState.queue,
      previousIndex,
      currentState.previewOnly,
      currentState.previewSeconds
    );
  }, [loadAndPlay]);

  const value = useMemo<AudioContextType>(
    () => ({
      ...state,
      play,
      playQueue,
      pause,
      resume,
      toggle,
      stop,
      seek,
      setVolume,
      next,
      prev,
      hasNext: state.queueIndex >= 0 && state.queueIndex < state.queue.length - 1,
      hasPrev: state.queueIndex > 0,
    }),
    [
      state,
      play,
      playQueue,
      pause,
      resume,
      toggle,
      stop,
      seek,
      setVolume,
      next,
      prev,
    ]
  );

  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>;
}

export function useAudio() {
  const ctx = useContext(AudioContext);

  if (!ctx) {
    throw new Error('useAudio must be used within AudioProvider');
  }

  return ctx;
}