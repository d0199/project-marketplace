import { useState, useEffect, useRef } from "react";
import { getCurrentUser, fetchUserAttributes } from "aws-amplify/auth";
import { uploadData } from "aws-amplify/storage";

interface Props {
  ptId: string;
  ptName: string;
  qualifications: string[];
  onClose: () => void;
}

export default function QualificationVerifyModal({ ptId, ptName, qualifications, onClose }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [evidence, setEvidence] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [status, setStatus] = useState<"form" | "success" | "error">("form");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pre-fill if logged in
  useEffect(() => {
    getCurrentUser()
      .then(() => fetchUserAttributes())
      .then((attrs) => {
        setEmail(attrs.email ?? "");
        setName(attrs.name ?? attrs.email ?? "");
      })
      .catch(() => {});
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    // Max 5 files, 10MB each
    const valid = selected.filter((f) => f.size <= 10 * 1024 * 1024);
    setFiles((prev) => [...prev, ...valid].slice(0, 5));
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !evidence.trim()) return;
    setSubmitting(true);

    try {
      // Upload files to S3 if any
      const fileKeys: string[] = [];
      if (files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          setUploadProgress(`Uploading ${i + 1} of ${files.length}...`);
          const ext = file.name.split(".").pop() ?? "bin";
          const key = `pt-evidence/${ptId}/${Date.now()}-${i}.${ext}`;
          try {
            await uploadData({
              path: key,
              data: file,
              options: {
                contentType: file.type,
              },
            }).result;
            fileKeys.push(key);
          } catch (uploadErr) {
            console.error("[QualificationVerifyModal] Upload failed:", uploadErr);
            // Continue without this file
          }
        }
        setUploadProgress("");
      }

      const res = await fetch("/api/pts/verify-qualifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ptId,
          ptName,
          name: name.trim(),
          email: email.trim(),
          evidence: evidence.trim(),
          qualifications,
          fileKeys,
        }),
      });
      if (res.ok) {
        setStatus("success");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    } finally {
      setSubmitting(false);
      setUploadProgress("");
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-2">
          <h2 className="text-lg font-bold text-gray-900">Verify Qualifications</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {status === "success" ? (
          <div className="p-8 text-center">
            <div className="flex justify-center mb-3">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <h3 className="font-semibold text-gray-900 text-lg mb-1">Evidence submitted</h3>
            <p className="text-gray-500 text-sm">
              Our team will review your qualifications and update your profile
              within 2 business days. We&apos;ll notify you at <strong>{email}</strong>.
            </p>
            <button
              onClick={onClose}
              className="mt-6 px-6 py-2 bg-brand-orange text-white rounded-lg text-sm font-semibold hover:bg-brand-orange-dark transition-colors"
            >
              Close
            </button>
          </div>
        ) : status === "error" ? (
          <div className="p-8 text-center">
            <div className="flex justify-center mb-3">
              <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
                <svg className="w-7 h-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>
            <h3 className="font-semibold text-gray-900 text-lg mb-1">Something went wrong</h3>
            <p className="text-gray-500 text-sm">Please try again or contact us directly.</p>
            <button
              onClick={() => setStatus("form")}
              className="mt-6 px-6 py-2 bg-brand-orange text-white rounded-lg text-sm font-semibold hover:bg-brand-orange-dark transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <p className="text-sm text-gray-500">
              Submit evidence of your qualifications for verification. Upload certificates
              or provide details like certificate numbers and issuing bodies.
            </p>

            {/* Qualifications being verified */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Qualifications to verify</label>
              <ul className="bg-gray-50 rounded-lg p-3 space-y-1">
                {qualifications.map((q) => (
                  <li key={q} className="flex items-center gap-2 text-sm text-gray-700">
                    <svg className="w-3.5 h-3.5 shrink-0 text-gray-400" fill="none" viewBox="0 0 20 20" stroke="currentColor" strokeWidth={2}>
                      <circle cx="10" cy="10" r="7" />
                    </svg>
                    {q}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Your name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Evidence <span className="text-gray-400 font-normal">(certificate numbers, issuing body, verification links)</span>
              </label>
              <textarea
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange resize-none"
                placeholder={"e.g.\nCert IV in Fitness — SIS40221, issued by Australian Institute of Fitness (2022)\nFirst Aid CPR — HLTAID011, issued by St John Ambulance, expires Dec 2027\nhttps://www.aif.edu.au/verify/12345"}
                required
              />
            </div>

            {/* File upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Upload certificates <span className="text-gray-400 font-normal">(optional, max 5 files, 10 MB each)</span>
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={files.length >= 5}
                className="w-full px-3 py-2.5 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-brand-orange hover:text-brand-orange transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  {files.length === 0 ? "Choose files" : "Add more files"}
                </span>
              </button>

              {files.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {files.map((f, i) => (
                    <li key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-1.5 text-sm">
                      <span className="text-gray-700 truncate mr-2">{f.name}</span>
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        className="text-gray-400 hover:text-red-500 shrink-0"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {uploadProgress && (
              <p className="text-xs text-brand-orange font-medium">{uploadProgress}</p>
            )}

            <button
              type="submit"
              disabled={submitting || !email.trim() || !evidence.trim()}
              className="w-full py-2.5 bg-brand-orange text-white rounded-lg text-sm font-semibold hover:bg-brand-orange-dark transition-colors disabled:opacity-50"
            >
              {submitting ? (uploadProgress || "Submitting...") : "Submit for Verification"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
