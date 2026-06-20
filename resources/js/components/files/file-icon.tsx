import { type FileEntry } from '@/types';
import {
    File,
    FileArchive,
    FileAudio,
    FileCode,
    FileImage,
    FileText,
    FileVideo,
    Folder,
} from 'lucide-react';

const BY_EXT: Record<string, typeof File> = {
    // images
    png: FileImage, jpg: FileImage, jpeg: FileImage, gif: FileImage, webp: FileImage, svg: FileImage, bmp: FileImage,
    // video
    mp4: FileVideo, mov: FileVideo, avi: FileVideo, mkv: FileVideo, webm: FileVideo,
    // audio
    mp3: FileAudio, wav: FileAudio, flac: FileAudio, ogg: FileAudio,
    // archives
    zip: FileArchive, tar: FileArchive, gz: FileArchive, rar: FileArchive, '7z': FileArchive,
    // code
    js: FileCode, ts: FileCode, tsx: FileCode, jsx: FileCode, json: FileCode, php: FileCode, py: FileCode,
    html: FileCode, css: FileCode, go: FileCode, rs: FileCode, sh: FileCode,
    // text/docs
    txt: FileText, md: FileText, pdf: FileText, doc: FileText, docx: FileText, csv: FileText,
};

export function FileIcon({ entry, className }: { entry: FileEntry; className?: string }) {
    if (entry.type === 'dir') {
        return <Folder className={className} />;
    }
    const Icon = (entry.extension && BY_EXT[entry.extension]) || File;
    return <Icon className={className} />;
}
