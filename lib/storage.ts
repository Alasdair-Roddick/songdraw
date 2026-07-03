import {
	CreateBucketCommand,
	DeleteObjectCommand,
	PutBucketPolicyCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";

const AVATAR_BUCKET = "avatars";

const s3 = new S3Client({
	endpoint: process.env.RUSTFS_ENDPOINT,
	region: "us-east-1",
	forcePathStyle: true,
	credentials: {
		accessKeyId: process.env.RUSTFS_ACCESS_KEY!,
		secretAccessKey: process.env.RUSTFS_SECRET_KEY!,
	},
});

let bucketReady: Promise<void> | null = null;

// Avatars are read directly by browsers (<img src>), so the bucket needs a
// public-read policy — everything else in RustFS stays private.
function ensureAvatarBucket() {
	if (!bucketReady) {
		bucketReady = (async () => {
			try {
				await s3.send(new CreateBucketCommand({ Bucket: AVATAR_BUCKET }));
			} catch (err) {
				const name = (err as { name?: string }).name;
				if (
					name !== "BucketAlreadyOwnedByYou" &&
					name !== "BucketAlreadyExists"
				) {
					throw err;
				}
			}
			await s3.send(
				new PutBucketPolicyCommand({
					Bucket: AVATAR_BUCKET,
					Policy: JSON.stringify({
						Version: "2012-10-17",
						Statement: [
							{
								Effect: "Allow",
								Principal: "*",
								Action: "s3:GetObject",
								Resource: `arn:aws:s3:::${AVATAR_BUCKET}/*`,
							},
						],
					}),
				}),
			);
		})();
	}
	return bucketReady;
}

const EXTENSION_BY_TYPE: Record<string, string> = {
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/webp": "webp",
};

export async function uploadAvatar(userId: string, file: File) {
	await ensureAvatarBucket();

	const key = `${userId}/${crypto.randomUUID()}.${EXTENSION_BY_TYPE[file.type]}`;
	const buffer = Buffer.from(await file.arrayBuffer());

	await s3.send(
		new PutObjectCommand({
			Bucket: AVATAR_BUCKET,
			Key: key,
			Body: buffer,
			ContentType: file.type,
		}),
	);

	return `${process.env.RUSTFS_PUBLIC_URL}/${AVATAR_BUCKET}/${key}`;
}

// Only deletes images we actually host — dicebear URLs (or anything else)
// are left alone.
export async function deleteAvatarIfOwned(url: string | null | undefined) {
	const prefix = `${process.env.RUSTFS_PUBLIC_URL}/${AVATAR_BUCKET}/`;
	if (!url?.startsWith(prefix)) return;

	const key = url.slice(prefix.length);
	await s3.send(new DeleteObjectCommand({ Bucket: AVATAR_BUCKET, Key: key }));
}
