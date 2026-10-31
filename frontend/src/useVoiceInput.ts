import { useEffect, useRef, useState } from "react";
import { transcribeAudio } from "./api";

export function useVoiceInput(
  onText: (text: string) => void,
  report: (error: Error) => void,
) {
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [starting, setStarting] = useState(false);
  const phase = useRef("idle");
  const active = useRef(true);
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const upload = useRef<AbortController | null>(null);

  function releaseMicrophone() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      upload.current?.abort();
      if (recorder.current) {
        recorder.current.onstop = null;
        recorder.current.ondataavailable = null;
        recorder.current.onerror = null;
        if (recorder.current.state !== "inactive") recorder.current.stop();
      }
      releaseMicrophone();
    };
  }, []);

  async function voice() {
    if (phase.current === "recording") {
      phase.current = "stopping";
      setTranscribing(true);
      recorder.current?.stop();
      setListening(false);
      return;
    }
    if (phase.current !== "idle") return;
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      report(
        new Error(
          "Браузер не поддерживает запись с микрофона. Попробуйте Chrome или Edge либо введите текст.",
        ),
      );
      return;
    }
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find(
      (type) => MediaRecorder.isTypeSupported(type),
    );
    if (!mime) {
      report(
        new Error(
          "Браузер не поддерживает нужный формат записи. Попробуйте Chrome или Edge.",
        ),
      );
      return;
    }
    phase.current = "starting";
    setStarting(true);
    try {
      const microphone = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      if (!active.current) {
        microphone.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = microphone;
      const recording = new MediaRecorder(microphone, {
        mimeType: mime,
        audioBitsPerSecond: 64000,
      });
      recorder.current = recording;
      const chunks: Blob[] = [];
      let total = 0,
        discarded = false;
      recording.ondataavailable = (event) => {
        if (!event.data.size) return;
        total += event.data.size;
        if (total > 4 * 1024 * 1024) {
          discarded = true;
          if (recording.state !== "inactive") recording.stop();
          report(
            new Error("Запись слишком большая. Запишите более короткую фразу."),
          );
        } else chunks.push(event.data);
      };
      recording.onerror = () => {
        discarded = true;
        if (recording.state !== "inactive") recording.stop();
        releaseMicrophone();
        phase.current = "idle";
        setListening(false);
        setTranscribing(false);
        report(
          new Error(
            "Запись прервалась. Проверьте микрофон и попробуйте снова.",
          ),
        );
      };
      recording.onstop = async () => {
        releaseMicrophone();
        recorder.current = null;
        if (!active.current) return;
        setListening(false);
        if (discarded || !total) {
          phase.current = "idle";
          setTranscribing(false);
          if (!discarded)
            report(new Error("Запись пустая. Повторите запись с микрофона."));
          return;
        }
        phase.current = "transcribing";
        setTranscribing(true);
        const controller = new AbortController();
        upload.current = controller;
        const timeout = setTimeout(() => controller.abort(), 45000);
        try {
          const text = await transcribeAudio(
            new Blob(chunks, { type: recording.mimeType || mime }),
            controller.signal,
          );
          if (active.current) onText(text);
        } catch (error) {
          if (active.current)
            report(
              new Error(
                controller.signal.aborted
                  ? "Распознавание заняло слишком много времени. Попробуйте снова."
                  : (error as Error).message,
              ),
            );
        } finally {
          clearTimeout(timeout);
          upload.current = null;
          phase.current = "idle";
          if (active.current) setTranscribing(false);
        }
      };
      recording.start(1000);
      phase.current = "recording";
      setListening(true);
      timer.current = setTimeout(() => {
        if (recording.state === "recording") {
          phase.current = "stopping";
          recording.stop();
        }
      }, 60000);
    } catch (error) {
      releaseMicrophone();
      phase.current = "idle";
      if (active.current)
        report(
          new Error(
            (error as DOMException).name === "NotAllowedError"
              ? "Разрешите доступ к микрофону в настройках браузера."
              : "Не удалось включить микрофон. Проверьте подключение и попробуйте снова.",
          ),
        );
    } finally {
      if (active.current) setStarting(false);
    }
  }
  return {
    voice,
    listening,
    transcribing,
    starting,
    voiceBusy: listening || transcribing || starting,
  };
}
