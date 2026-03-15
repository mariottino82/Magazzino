import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { XCircle, Camera, RefreshCw, CheckCircle2 } from 'lucide-react';

interface BarcodeScannerProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScan, onClose }) => {
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanSuccess, setScanSuccess] = useState<string | null>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  const isInitializing = useRef(false);

  const startScanner = async () => {
    if (isInitializing.current || scanSuccess) return;
    isInitializing.current = true;

    try {
      setError(null);
      
      if (!window.isSecureContext) {
        setError("La fotocamera richiede HTTPS. Su questo server (HTTP) il browser blocca l'accesso.");
        isInitializing.current = false;
        return;
      }

      // Ensure previous instance is stopped
      if (html5QrCodeRef.current) {
        if (html5QrCodeRef.current.isScanning) {
          try {
            await html5QrCodeRef.current.stop();
          } catch (e) {
            console.warn("Stop failed during restart:", e);
          }
        }
      } else {
        html5QrCodeRef.current = new Html5Qrcode("reader");
      }

      // Small delay to let the UI settle
      await new Promise(resolve => setTimeout(resolve, 350));

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 150 },
        aspectRatio: 1.0
      };

      try {
        await html5QrCodeRef.current.start(
          { facingMode: "environment" },
          config,
          (decodedText) => {
            setScanSuccess(decodedText);
            setIsScanning(false);
            // Give a moment to show the success UI and stop the camera
            setTimeout(async () => {
              await stopScanner();
              onScan(decodedText);
            }, 800);
          },
          () => {}
        );
      } catch (err) {
        console.warn("FacingMode failed, trying fallback", err);
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          await html5QrCodeRef.current.start(
            devices[devices.length - 1].id,
            config,
            (decodedText) => {
              setScanSuccess(decodedText);
              setIsScanning(false);
              setTimeout(async () => {
                await stopScanner();
                onScan(decodedText);
              }, 800);
            },
            () => {}
          );
        } else {
          throw err;
        }
      }
      
      setIsScanning(true);
    } catch (err: any) {
      console.error("Scanner error:", err);
      let errorMessage = err.message || "Errore sconosciuto";
      
      if (errorMessage.includes("NotAllowedError") || errorMessage.includes("Permission denied")) {
        setError("Accesso negato. Controlla i permessi del browser.");
      } else if (errorMessage.includes("ongoing")) {
        setError("Lo scanner è già in funzione. Chiudi e riapri.");
      } else {
        setError(`Errore tecnico: ${errorMessage}. Ricarica la pagina.`);
      }
    } finally {
      isInitializing.current = false;
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
        setIsScanning(false);
      } catch (err) {
        console.error("Failed to stop scanner", err);
      }
    }
  };

  useEffect(() => {
    startScanner();
    return () => {
      stopScanner();
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/90 z-[70] flex flex-col items-center justify-center p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-4 sm:p-6 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Camera className="text-emerald-600" size={20} />
            <h3 className="font-bold text-lg">Scansiona Barcode</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900 transition-colors">
            <XCircle size={28} />
          </button>
        </div>

        <div className="relative bg-black flex-1 min-h-[300px] flex items-center justify-center overflow-hidden">
          <div id="reader" className="w-full h-full"></div>
          
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-black/60">
              <div className="bg-white p-6 rounded-2xl shadow-xl max-w-xs">
                <p className="text-red-600 font-medium mb-4 text-sm">{error}</p>
                <button 
                  onClick={startScanner}
                  className="flex items-center gap-2 mx-auto bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-emerald-700 transition-colors"
                >
                  <RefreshCw size={16} /> Riprova
                </button>
              </div>
            </div>
          )}

          {!isScanning && !error && !scanSuccess && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-white text-sm font-medium">Inizializzazione fotocamera...</p>
              </div>
            </div>
          )}

          {scanSuccess && (
            <div className="absolute inset-0 flex items-center justify-center bg-emerald-600/20 backdrop-blur-[2px]">
              <div className="flex flex-col items-center gap-3 bg-white p-6 rounded-2xl shadow-2xl">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                  <CheckCircle2 size={32} />
                </div>
                <div className="text-center">
                  <p className="text-gray-900 font-bold">Codice rilevato!</p>
                  <p className="text-xs font-mono text-emerald-600 mt-1">{scanSuccess}</p>
                </div>
              </div>
            </div>
          )}
          
          {/* Scanning Overlay */}
          {isScanning && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[250px] h-[150px] border-2 border-emerald-500 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-emerald-500 -translate-x-1 -translate-y-1"></div>
                <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-emerald-500 translate-x-1 -translate-y-1"></div>
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-emerald-500 -translate-x-1 translate-y-1"></div>
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-emerald-500 translate-x-1 translate-y-1"></div>
                <div className="absolute top-0 left-0 w-full h-0.5 bg-emerald-500/50 animate-scan shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 sm:p-6 bg-gray-50 text-center shrink-0">
          <p className="text-sm text-gray-600 font-medium">
            Posiziona il codice a barre all'interno del riquadro
          </p>
          <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider font-bold">
            Supporta EAN, UPC, Code 128 e altri
          </p>
        </div>
      </div>
      
      <style>{`
        @keyframes scan {
          0% { top: 0; }
          100% { top: 100%; }
        }
        #reader video {
          object-fit: cover !important;
          width: 100% !important;
          height: 100% !important;
        }
      `}</style>
    </div>
  );
};
