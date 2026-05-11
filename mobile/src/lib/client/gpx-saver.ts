import { registerPlugin, Capacitor } from '@capacitor/core';

interface GpxSaverPlugin {
  save(opts: { filename: string; content: string }): Promise<{ uri: string }>;
}

const GpxSaver = registerPlugin<GpxSaverPlugin>('GpxSaver');

export class SaveCancelledError extends Error {
  readonly name = 'SaveCancelledError';
}

/**
 * Opens the system "Save As" picker, lets the user choose a destination,
 * and writes the GPX content there. Resolves to the URI of the saved file,
 * or throws SaveCancelledError if the user backs out.
 */
export async function saveGpxFile(filename: string, content: string): Promise<string> {
  if (Capacitor.getPlatform() !== 'android') {
    throw new Error('Saving files is only available in the Android app.');
  }
  try {
    const { uri } = await GpxSaver.save({ filename, content });
    return uri;
  } catch (e) {
    const msg = (e as Error).message?.toLowerCase() ?? '';
    if (msg.includes('cancel')) throw new SaveCancelledError();
    throw e;
  }
}
