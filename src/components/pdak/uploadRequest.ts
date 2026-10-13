import type { PreviewResult } from "./UploadCard";

export function uploadRequest(
  url: string,
  form: FormData,
  onProgress: (percent: number | null) => void,
): Promise<{
  ok: boolean;
  payload: {
    success: boolean;
    message: string;
    data: { results: PreviewResult[] };
  };
}> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", url);
    request.timeout = 180000;
    request.upload.onprogress = (event) =>
      onProgress(
        event.lengthComputable
          ? Math.round((event.loaded / event.total) * 100)
          : null,
      );
    request.upload.onload = () => onProgress(null);
    request.onerror = () =>
      reject(
        new Error("Koneksi terputus. Periksa status sebelum mencoba lagi."),
      );
    request.ontimeout = () =>
      reject(
        new Error(
          "Waktu tunggu habis. Periksa status untuk memastikan hasil penyimpanan.",
        ),
      );
    request.onload = () => {
      try {
        resolve({
          ok: request.status >= 200 && request.status < 300,
          payload: JSON.parse(request.responseText),
        });
      } catch {
        reject(new Error("Respons server tidak valid. Periksa status upload."));
      }
    };
    request.send(form);
  });
}
