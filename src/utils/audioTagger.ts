function getAudioContext() {
  const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!Ctx) {
    throw new Error('This browser does not support audio tagging.');
  }

  return new Ctx();
}

async function readSourceBuffer(source: File | string) {
  if (typeof source === 'string') {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error('Could not load the source audio for tagging.');
    }
    return response.arrayBuffer();
  }

  return source.arrayBuffer();
}

function encodeWav(samples: Float32Array, sampleRate: number) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  function writeString(offset: number, value: string) {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  }

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index] || 0));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function mergeChannels(buffer: AudioBuffer) {
  const left = buffer.getChannelData(0);
  const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left;
  const merged = new Float32Array(buffer.length);

  for (let index = 0; index < buffer.length; index += 1) {
    merged[index] = (left[index] + right[index]) * 0.5;
  }

  return merged;
}

function dbToGain(db: number) {
  return Math.pow(10, db / 20);
}

export async function renderTaggedAudio(
  source: File | string,
  tagFile: File,
  placements: number[],
  outputName: string
) {
  const audioContext = getAudioContext();

  try {
    const [sourceArrayBuffer, tagArrayBuffer] = await Promise.all([
      readSourceBuffer(source),
      tagFile.arrayBuffer(),
    ]);

    const [sourceBuffer, tagBuffer] = await Promise.all([
      audioContext.decodeAudioData(sourceArrayBuffer.slice(0)),
      audioContext.decodeAudioData(tagArrayBuffer.slice(0)),
    ]);

    const duration = Math.max(
      sourceBuffer.duration,
      ...placements.map((placement) => Math.max(0, placement) + tagBuffer.duration)
    );

    const offlineContext = new OfflineAudioContext(1, Math.ceil(duration * sourceBuffer.sampleRate), sourceBuffer.sampleRate);
    const sourceNode = offlineContext.createBufferSource();
    sourceNode.buffer = sourceBuffer;
    sourceNode.connect(offlineContext.destination);
    sourceNode.start(0);

    placements
      .map((placement) => Math.max(0, placement))
      .forEach((placement) => {
        const tagNode = offlineContext.createBufferSource();
        const tagGain = offlineContext.createGain();
        const dryGain = offlineContext.createGain();
        const wetGain = offlineContext.createGain();
        const delayA = offlineContext.createDelay(1.5);
        const delayB = offlineContext.createDelay(1.5);
        const feedbackA = offlineContext.createGain();
        const feedbackB = offlineContext.createGain();

        tagNode.buffer = tagBuffer;
        tagGain.gain.value = dbToGain(2);
        dryGain.gain.value = 0.85;
        wetGain.gain.value = 0.15;
        delayA.delayTime.value = 0.18;
        delayB.delayTime.value = 0.31;
        feedbackA.gain.value = 0.28;
        feedbackB.gain.value = 0.22;

        tagNode.connect(tagGain);
        tagGain.connect(dryGain);
        tagGain.connect(wetGain);

        dryGain.connect(offlineContext.destination);

        wetGain.connect(delayA);
        wetGain.connect(delayB);
        delayA.connect(feedbackA);
        feedbackA.connect(delayB);
        delayB.connect(feedbackB);
        feedbackB.connect(delayA);
        delayA.connect(offlineContext.destination);
        delayB.connect(offlineContext.destination);
        tagNode.start(placement);
      });

    const rendered = await offlineContext.startRendering();
    const wavBlob = encodeWav(mergeChannels(rendered), rendered.sampleRate);

    return new File([wavBlob], `${outputName.replace(/\.[^/.]+$/, '') || 'tagged-beat'}.wav`, {
      type: 'audio/wav',
      lastModified: Date.now(),
    });
  } finally {
    await audioContext.close();
  }
}
