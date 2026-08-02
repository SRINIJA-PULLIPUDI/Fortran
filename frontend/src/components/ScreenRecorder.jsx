import { useRef, useState } from 'react';
import api from '../api/client';

// Captures the user's screen for the duration of a contest and uploads the
// recording to the backend when stopped. Requires the browser Screen Capture
// API (getDisplayMedia) - works in Chrome, Edge, Firefox over HTTPS or
// localhost. This is genuine screen recording, not a simulation, but it is
// NOT tamper-proof proctoring: the user must grant permission and can revoke
// it, and there is no server-side enforcement that a recording exists before
// accepting submissions. For real exam-grade proctoring you'd pair this with
// a server-side check that blocks submissions if no active recording session
// is on file for that user + contest.
export default function ScreenRecorder({ contestId }) {
  const [status, setStatus] = useState('idle'); // idle | recording | uploading | done | error
  const [errorMsg, setErrorMsg] = useState('');
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const startedAtRef = useRef(null);

  async function startRecording() {
    setErrorMsg('');
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      streamRef.current = stream;
      chunksRef.current = [];
      startedAtRef.current = new Date();

      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = uploadRecording;
      // Stop recording automatically if the user manually ends screen share
      stream.getVideoTracks()[0].onended = () => stopRecording();

      recorder.start();
      mediaRecorderRef.current = recorder;
      setStatus('recording');
    } catch (err) {
      setErrorMsg('Screen share permission was denied or unavailable.');
      setStatus('error');
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
  }

  async function uploadRecording() {
    setStatus('uploading');
    try {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const formData = new FormData();
      formData.append('recording', blob, `contest-${contestId}-${Date.now()}.webm`);
      formData.append('contestId', contestId);
      formData.append('startedAt', startedAtRef.current.toISOString());
      formData.append('endedAt', new Date().toISOString());

      await api.post('/recordings', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setStatus('done');
    } catch (err) {
      setErrorMsg('Recording captured but upload failed. Check your connection and try again.');
      setStatus('error');
    }
  }

  return (
    <div className="recorder-box">
      <h4>Contest Screen Recording</h4>
      {status === 'idle' && (
        <>
          <p className="muted">This contest requires your screen to be recorded for the duration of the attempt.</p>
          <button onClick={startRecording}>Start Screen Recording</button>
        </>
      )}
      {status === 'recording' && (
        <>
          <p className="recording-indicator">● Recording in progress</p>
          <button onClick={stopRecording}>Stop &amp; Submit Recording</button>
        </>
      )}
      {status === 'uploading' && <p>Uploading recording...</p>}
      {status === 'done' && <p className="success">Recording uploaded successfully.</p>}
      {status === 'error' && <p className="error">{errorMsg}</p>}
    </div>
  );
}
