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
const BUCKET = process.env.S3_BUCKET!;
const PUBLIC_URL = process.env.S3_PUBLIC_URL!;

const s3 = new S3Client({
	endpoint: process.env.S3_ENDPOINT,
	region: process.env.S3_REGION || "auto",
	forcePathStyle: true,
	credentials: {
		accessKeyId: process.env.S3_ACCESS_KEY_ID!,
		secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
	},
});

const EXTENSION_BY_TYPE: Record<string, string> = {
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/webp": "webp",
};

export async function uploadAvatar(userId: string, file: File) {
	const key = `avatars/${userId}/${crypto.randomUUID()}.${EXTENSION_BY_TYPE[file.type]}`;
	const buffer = Buffer.from(await file.arrayBuffer());

	await s3.send(
		new PutObjectCommand({
			Bucket: BUCKET,
			Key: key,
			Body: buffer,
			ContentType: file.type,
		}),
	);

	return `${PUBLIC_URL}/${key}`;
}

// Only deletes images we actually host — dicebear URLs (or anything else)
// are left alone.
export async function deleteAvatarIfOwned(url: string | null | undefined) {
	const prefix = `${PUBLIC_URL}/`;
	if (!url?.startsWith(prefix)) return;

	const key = url.slice(prefix.length);
	await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
