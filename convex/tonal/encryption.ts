const ALGORITHM = "AES-GCM";
const IV_LENGTH = 12;
const TAG_LENGTH = 128; // bits

function hexToBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes.buffer;
}

function bufferToBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function base64ToBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function importKey(keyHex: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", hexToBuffer(keyHex), { name: ALGORITHM }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encrypt(plaintext: string, keyHex: string): Promise<string> {
  const key = await importKey(keyHex);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
    key,
    encoded,
  );

  // Web Crypto appends the auth tag to the ciphertext
  // Split into data + tag for our format
  const ctBytes = new Uint8Array(ciphertext);
  const tagStart = ctBytes.length - TAG_LENGTH / 8;
  const data = ctBytes.slice(0, tagStart);
  const tag = ctBytes.slice(tagStart);

  return `${bufferToBase64(iv.buffer)}:${bufferToBase64(tag.buffer)}:${bufferToBase64(data.buffer)}`;
}

export async function decrypt(encoded: string, keyHex: string): Promise<string> {
  const key = await importKey(keyHex);
  const [ivB64, tagB64, dataB64] = encoded.split(":");
  const iv = base64ToBuffer(ivB64);
  const tag = new Uint8Array(base64ToBuffer(tagB64));
  const data = new Uint8Array(base64ToBuffer(dataB64));

  // Web Crypto expects tag appended to ciphertext
  const combined = new Uint8Array(data.length + tag.length);
  combined.set(data, 0);
  combined.set(tag, data.length);

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
    key,
    combined,
  );

  return new TextDecoder().decode(decrypted);
}
