import {
	DeleteObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";

// S3-compatible object storage for profile pictures. Configured for Cloudflare
// R2 (endpoint https://<accountid>.r2.cloudflarestorage.com, region "auto"),
// but any S3-compatible provider works by swapping the env vars.
//
// The bucket must already exist and be publicly readable — on R2 that means
// attaching a custom domain (or enabling the r2.dev subdomain) in the
// Cloudflare dashboard. R2 has no PutBucketPolicy, so public access can't be
// granted from code. See docs/object-storage.md.
function requiredStorageEnv(name: string) {
	const value = process.env[name];
	if (!value) throw new Error(`${name} is required for avatar storage`);
	return value;
}

function storageConfig() {
	const publicUrl = requiredStorageEnv("S3_PUBLIC_URL");
	return {
		bucket: requiredStorageEnv("S3_BUCKET"),
		publicUrl,
		publicHost: new URL(publicUrl).host,
		s3: new S3Client({
			endpoint: process.env.S3_ENDPOINT,
			region: process.env.S3_REGION || "auto",
			forcePathStyle: true,
			credentials: {
				accessKeyId: requiredStorageEnv("S3_ACCESS_KEY_ID"),
				secretAccessKey: requiredStorageEnv("S3_SECRET_ACCESS_KEY"),
			},
		}),
	};
}

const EXTENSION_BY_TYPE: Record<string, string> = {
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/webp": "webp",
};

export async function uploadAvatar(userId: string, file: File) {
	const { bucket, publicUrl, s3 } = storageConfig();
	const key = `avatars/${userId}/${crypto.randomUUID()}.${EXTENSION_BY_TYPE[file.type]}`;
	const buffer = Buffer.from(await file.arrayBuffer());

	await s3.send(
		new PutObjectCommand({
			Bucket: bucket,
			Key: key,
			Body: buffer,
			ContentType: file.type,
		}),
	);

	return `${publicUrl}/${key}`;
}

// Deletes an avatar object we host. Matches on our storage host + the
// `avatars/` key prefix rather than the full S3_PUBLIC_URL, so URLs stored
// before S3_PUBLIC_URL last changed (e.g. gained/lost the bucket segment) are
// still recognised and cleaned up. dicebear URLs (or anything else) are left
// alone. Best-effort: a failed delete is logged, never thrown — losing an
// avatar swap over a stale orphan isn't worth it.
export async function deleteAvatarIfOwned(url: string | null | undefined) {
	if (!url) return;
	const { bucket, publicHost, s3 } = storageConfig();

	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return;
	}

	const marker = "/avatars/";
	const idx = parsed.pathname.indexOf(marker);
	if (parsed.host !== publicHost || idx === -1) return;

	// Object key is always `avatars/<userId>/<uuid>.<ext>` regardless of any
	// bucket segment the public host puts in front of it.
	const key = parsed.pathname.slice(idx + 1);

	try {
		await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
	} catch (err) {
		console.error(`failed to delete old avatar ${key}`, err);
	}
}
