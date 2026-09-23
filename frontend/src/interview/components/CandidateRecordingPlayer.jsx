import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Download,
  Video,
  Clock,
  HardDrive,
  Sparkles,
  AlertCircle,
  RotateCcw,
  Film,
} from 'lucide-react';
import { interviewApi } from '../services/interviewApi';

function formatDuration(sec) {
  if (!sec || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function formatBytes(bytes) {
  if (!bytes || isNaN(bytes)) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function CandidateRecordingPlayer({ round, candidateName = 'Candidate' }) {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(round?.recording_metadata?.duration_seconds || 0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const roundId = round?.id;
  const streamUrl = roundId ? interviewApi.getRecordingStreamUrl(roundId) : null;
  const downloadUrl = roundId ? interviewApi.getRecordingStreamUrl(roundId, true) : null;
  const metadata = round?.recording_metadata || {};
  const candNameClean = (candidateName || 'candidate').replace(/\s+/g, '_');
  const downloadFileName = `interview_${candNameClean}_${round?.round_name ? round.round_name.replace(/\s+/g, '_') : 'round'}.webm`;

  useEffect(() => {
    setHasError(false);
    setIsLoading(true);
    setIsPlaying(false);
    setCurrentTime(0);
    if (round?.recording_metadata?.duration_seconds) {
      setDuration(round.recording_metadata.duration_seconds);
    }
  }, [roundId]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((e) => {
          console.warn('Playback error:', e);
          setIsPlaying(false);
        });
    }
  };

  const handleSeek = (e) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
  };

  const handleSpeedChange = (speed) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        videoRef.current.requestFullscreen().catch((err) => console.warn(err));
      }
    }
  };

  if (!roundId) return null;

  return (
    <div className="p-5 bg-gradient-to-b from-zinc-900 to-zinc-950 text-white rounded-3xl border border-zinc-800 space-y-4 shadow-xl animate-in fade-in duration-300">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold border border-purple-500/30">
            <Film size={16} />
          </div>
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-2">
              <span>Candidate Video Recording</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                AI CAPTURED
              </span>
            </div>
            <div className="text-[11px] text-zinc-400">
              Synchronized video & audio record for {candidateName}
            </div>
          </div>
        </div>

        {/* Action badges and download */}
        <div className="flex items-center gap-2">
          {metadata.size_bytes ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800 border border-zinc-700/60 text-[11px] text-zinc-300 font-mono">
              <HardDrive size={11} className="text-zinc-400" />
              {formatBytes(metadata.size_bytes)}
            </span>
          ) : null}

          {duration > 0 ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800 border border-zinc-700/60 text-[11px] text-zinc-300 font-mono">
              <Clock size={11} className="text-zinc-400" />
              {formatDuration(duration)}
            </span>
          ) : null}

          {!hasError && (
            <a
              href={downloadUrl}
              download={downloadFileName}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-white text-xs font-semibold border border-zinc-700 transition cursor-pointer"
              title="Download recording file"
            >
              <Download size={13} />
              <span>Download</span>
            </a>
          )}
        </div>
      </div>

      {/* Video Container */}
      {hasError ? (
        <div className="w-full py-10 px-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-400 flex items-center justify-center mb-3">
            <Video size={22} />
          </div>
          <div className="text-xs font-bold text-zinc-200">No Video Recording Available</div>
          <p className="text-[11px] text-zinc-500 max-w-sm mt-1">
            {round?.status === 'Completed'
              ? 'Video was either disabled by the candidate during this session or not yet uploaded.'
              : 'Recording will appear here automatically once the candidate concludes the interview.'}
          </p>
        </div>
      ) : (
        <div className="relative rounded-2xl overflow-hidden bg-black border border-zinc-800/80 group shadow-2xl">
          <video
            ref={videoRef}
            src={streamUrl}
            playsInline
            preload="metadata"
            className="w-full aspect-video object-cover cursor-pointer"
            onClick={togglePlay}
            onTimeUpdate={() => {
              if (videoRef.current) {
                setCurrentTime(videoRef.current.currentTime);
                if (videoRef.current.duration && !isNaN(videoRef.current.duration)) {
                  setDuration(videoRef.current.duration);
                }
              }
            }}
            onLoadedMetadata={() => {
              setIsLoading(false);
              if (videoRef.current?.duration && !isNaN(videoRef.current.duration)) {
                setDuration(videoRef.current.duration);
              }
            }}
            onEnded={() => setIsPlaying(false)}
            onError={() => {
              setHasError(true);
              setIsLoading(false);
            }}
          />

          {/* Central Play button overlay if paused */}
          {!isPlaying && !isLoading && (
            <button
              type="button"
              onClick={togglePlay}
              className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 text-white flex items-center justify-center transition active:scale-95 cursor-pointer shadow-2xl"
            >
              <Play size={24} className="ml-1 fill-white" />
            </button>
          )}

          {/* Bottom Custom Playback Bar */}
          <div className="p-3 bg-zinc-950/90 backdrop-blur-md border-t border-zinc-800/80 space-y-2">
            {/* Scrubber slider */}
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={duration || 100}
                step={0.5}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
              />
            </div>

            {/* Controls row */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={togglePlay}
                  className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white flex items-center justify-center transition cursor-pointer"
                >
                  {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5 fill-white" />}
                </button>

                <button
                  type="button"
                  onClick={toggleMute}
                  className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center transition cursor-pointer"
                >
                  {isMuted ? <VolumeX size={14} className="text-rose-400" /> : <Volume2 size={14} />}
                </button>

                {/* Time counter */}
                <div className="text-[11px] font-mono text-zinc-400">
                  <span className="text-zinc-200 font-semibold">{formatDuration(currentTime)}</span>
                  <span> / </span>
                  <span>{formatDuration(duration)}</span>
                </div>
              </div>

              {/* Speed Multiplier & Fullscreen */}
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
                  {[1, 1.25, 1.5, 2].map((spd) => (
                    <button
                      key={spd}
                      type="button"
                      onClick={() => handleSpeedChange(spd)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                        playbackSpeed === spd
                          ? 'bg-emerald-500 text-zinc-950'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center transition cursor-pointer"
                  title="Fullscreen"
                >
                  <Maximize2 size={13} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
