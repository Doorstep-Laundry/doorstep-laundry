import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions, isStaff } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";
import { prisma } from "@/lib/db";
import { DownloadApkButton } from "./download-apk-button";

function formatBytes(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}

export default async function DownloadPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const role = (session.user as { role: string }).role;
  if (!isStaff(role)) redirect("/dashboard");

  const release = await prisma.appRelease.findFirst({
    orderBy: { uploadedAt: "desc" },
    select: { version: true, versionCode: true, size: true, notes: true, uploadedAt: true },
  });

  return (
    <div className="min-h-screen bg-fern-50">
      <AppHeader />
      <main className="mx-auto max-w-lg px-4 py-8">
        <h1 className="text-xl font-semibold text-fern-900 mb-6">Driver App</h1>
        {release ? (
          <div className="bg-white rounded-xl shadow-sm border border-fern-100 p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-2xl font-bold text-fern-900">{release.version}</p>
                <p className="text-sm text-fern-500">build {release.versionCode}</p>
              </div>
              <DownloadApkButton />
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-fern-500 mb-0.5">Size</p>
                <p className="text-fern-800 font-medium">{formatBytes(release.size)}</p>
              </div>
              <div>
                <p className="text-fern-500 mb-0.5">Published</p>
                <p className="text-fern-800 font-medium">{new Date(release.uploadedAt).toLocaleDateString()}</p>
              </div>
            </div>
            {release.notes && (
              <div>
                <p className="text-sm text-fern-500 mb-1">Release notes</p>
                <p className="text-sm text-fern-700 whitespace-pre-line">{release.notes}</p>
              </div>
            )}
            <div className="rounded-lg bg-fern-50 border border-fern-200 p-4 text-sm text-fern-700 space-y-1">
              <p className="font-medium">Installing the APK</p>
              <ol className="list-decimal list-inside space-y-1 text-fern-600">
                <li>Tap Download APK above</li>
                <li>Open the downloaded file in Chrome</li>
                <li>If prompted, enable &quot;Install unknown apps&quot; for Chrome</li>
                <li>Tap Install</li>
              </ol>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-fern-100 p-6 text-center">
            <p className="text-fern-600">No release available yet.</p>
          </div>
        )}
      </main>
    </div>
  );
}
