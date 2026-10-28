import { z } from 'zod';
import { listResult, writeResult } from '../format.mjs';

const IMAGE_FIELDS = ['AdImageHash', 'Name', 'Type', 'Subtype', 'Associated', 'OriginalUrl', 'PreviewUrl'];

// Direct accepts JPG/PNG/GIF up to 10 MB for text-ad images (REGULAR / WIDE).
const IMAGE_MIME = /^image\/(jpeg|png|gif)\b/;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

// Download an image and return it base64-encoded, rejecting anything Direct would refuse.
async function fetchImageBase64(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not download image (${response.status}): ${url}`);

  const type = response.headers.get('content-type') || '';
  if (!IMAGE_MIME.test(type)) throw new Error(`Not a JPG/PNG/GIF image (content-type "${type}"): ${url}`);

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_IMAGE_BYTES) {
    throw new Error(`Image is ${(bytes.length / 1048576).toFixed(1)} MB; Direct accepts at most 10 MB.`);
  }
  return bytes.toString('base64');
}

export function registerImageTools(server, client) {
  server.registerTool(
    'upload-ad-image',
    {
      title: 'Upload Ad Image',
      description:
        'WRITE — adds an image to the account image library and returns its AdImageHash, which create-text-ad takes as image_hash. ' +
        'Give exactly one of image_url or image_base64 (JPG/PNG/GIF, max 10 MB). Text ads need a REGULAR (1:1 to 4:3, 450–5000 px per side) ' +
        'or WIDE (16:9, at least 1080×607) image. Affects the SANDBOX account unless YANDEX_DIRECT_LIVE=1.',
      inputSchema: {
        name: z.string().min(1).max(255).describe('Name for the image in the library'),
        image_url: z.string().url().optional().describe('Public URL to download the image from'),
        image_base64: z.string().optional().describe('Image file contents, base64-encoded'),
        type: z
          .enum(['AUTO', 'REGULAR', 'WIDE', 'FIXED_IMAGE'])
          .optional()
          .describe('Image type; AUTO (default) lets Direct detect it from the dimensions'),
      },
    },
    async ({ name, image_url, image_base64, type }) => {
      if (Boolean(image_url) === Boolean(image_base64)) {
        throw new Error('Provide exactly one of image_url or image_base64.');
      }
      const ImageData = image_base64 ?? (await fetchImageBase64(image_url));
      const result = await client.directRequest('adimages', 'add', {
        AdImages: [{ Name: name, ImageData, ...(type ? { Type: type } : {}) }],
      });
      return writeResult(`Upload image "${name}"`, result);
    },
  );

  server.registerTool(
    'list-ad-images',
    {
      title: 'List Ad Images',
      description:
        'READ. Lists images in the account image library with their AdImageHash, type, and whether an ad uses them.',
      inputSchema: {
        hashes: z.array(z.string()).optional().describe('Only these AdImageHash values'),
        associated: z
          .enum(['YES', 'NO'])
          .optional()
          .describe('YES = only images attached to an ad, NO = only unused images'),
        limit: z.number().min(1).max(10000).optional().describe('Max images to return (default 100)'),
      },
    },
    async ({ hashes, associated, limit = 100 }) => {
      const SelectionCriteria = {};
      if (hashes?.length) SelectionCriteria.AdImageHashes = hashes;
      if (associated) SelectionCriteria.Associated = associated;
      const result = await client.directRequest('adimages', 'get', {
        SelectionCriteria,
        FieldNames: IMAGE_FIELDS,
        Page: { Limit: limit },
      });
      const lines = (result.AdImages || []).map((img) => {
        const subtype = img.Subtype && img.Subtype !== 'NONE' ? `/${img.Subtype}` : '';
        return `- ${img.AdImageHash} — "${img.Name}", ${img.Type}${subtype}, in use: ${img.Associated}`;
      });
      return listResult('image', lines, result);
    },
  );
}
