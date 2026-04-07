import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Upload as UploadIcon, Music, Check, AlertCircle, Sparkles, Clock, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { uploadApi, artistApi } from '@/lib/api';
import { toast } from 'sonner';

interface UploadProgress {
  fileName: string;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  message?: string;
}

interface ArtistStatus {
  is_artist: boolean;
  has_application: boolean;
  application_status: 'pending' | 'approved' | 'rejected' | null;
  application_date: string | null;
  artist_bio: string | null;
}

const Upload = () => {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [uploads, setUploads] = useState<UploadProgress[]>([]);

  // Artist status
  const [artistStatus, setArtistStatus] = useState<ArtistStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Artist application form
  const [artistName, setArtistName] = useState('');
  const [bio, setBio] = useState('');
  const [socialLinks, setSocialLinks] = useState('');
  const [sampleWorkUrl, setSampleWorkUrl] = useState('');
  const [submittingApplication, setSubmittingApplication] = useState(false);

  useEffect(() => {
    fetchArtistStatus();
  }, []);

  const fetchArtistStatus = async () => {
    try {
      const response = await artistApi.getStatus();
      setArtistStatus(response.data);
    } catch (error) {
      console.error('Failed to fetch artist status:', error);
      toast.error('Failed to load artist status');
    } finally {
      setLoadingStatus(false);
    }
  };

  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type.startsWith('audio/')) {
        setAudioFile(file);
        if (!title) {
          setTitle(file.name.replace(/\.[^/.]+$/, ''));
        }
      } else {
        toast.error('Please select a valid audio file');
      }
    }
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        setCoverFile(file);
      } else {
        toast.error('Please select a valid image file');
      }
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error('Please enter a song title');
      return;
    }

    if (!artist.trim()) {
      toast.error('Please enter an artist name');
      return;
    }

    if (!audioFile) {
      toast.error('Please select an audio file');
      return;
    }

    if (!coverFile) {
      toast.error('Please select a cover image');
      return;
    }

    const formData = new FormData();
    formData.append('title', title);
    formData.append('artist', artist);
    formData.append('audio', audioFile);
    formData.append('cover', coverFile);

    const progress: UploadProgress = {
      fileName: `${title} - ${artist}`,
      progress: 0,
      status: 'uploading',
    };

    setUploadProgress(progress);
    setUploading(true);

    try {
      const response = await uploadApi.song(formData);
      if (!response || response.status !== 200 || !response.data || response.data.msg !== 'Song uploaded') {
        throw new Error('Invalid response from server');
      }

      const successProgress: UploadProgress = {
        fileName: `${title} - ${artist}`,
        progress: 100,
        status: 'success',
        message: 'Upload completed successfully',
      };

      setUploadProgress(successProgress);
      setUploads([...uploads, successProgress]);
      toast.success('Song uploaded successfully!');

      setTitle('');
      setArtist('');
      setAudioFile(null);
      setCoverFile(null);

      const audioInput = document.getElementById('audio-input') as HTMLInputElement;
      const coverInput = document.getElementById('cover-input') as HTMLInputElement;
      if (audioInput) audioInput.value = '';
      if (coverInput) coverInput.value = '';

      setTimeout(() => setUploadProgress(null), 3000);
    } catch (error: any) {
      console.error('Upload error:', error);
      const errorProgress: UploadProgress = {
        fileName: `${title} - ${artist}`,
        progress: 0,
        status: 'error',
        message: error?.response?.data?.error || error?.message || 'Upload failed',
      };

      setUploadProgress(errorProgress);
      setUploads([...uploads, errorProgress]);
      toast.error(error?.response?.data?.error || 'Failed to upload song');
    } finally {
      setUploading(false);
    }
  };

  const handleArtistApplication = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!artistName.trim()) {
      toast.error('Please enter your artist name');
      return;
    }

    if (!bio.trim()) {
      toast.error('Please write a bio');
      return;
    }

    if (bio.length < 50) {
      toast.error('Bio must be at least 50 characters');
      return;
    }

    setSubmittingApplication(true);

    try {
      await artistApi.apply({
        artist_name: artistName,
        bio: bio,
        social_links: socialLinks,
        sample_work_url: sampleWorkUrl,
      });

      toast.success('Artist application submitted successfully!');
      fetchArtistStatus(); // Refresh status
    } catch (error: any) {
      console.error('Application error:', error);
      toast.error(error?.response?.data?.error || 'Failed to submit application');
    } finally {
      setSubmittingApplication(false);
    }
  };

  if (loadingStatus) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  // Not a verified artist - show application form or pending message
  if (!artistStatus?.is_artist) {
    // Has pending application
    if (artistStatus?.application_status === 'pending') {
      return (
        <div className="p-6 space-y-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Clock className="w-8 h-8 text-yellow-500" />
              <h1 className="text-4xl font-bold">Application Pending</h1>
            </div>
            <p className="text-muted-foreground">Your artist verification is being reviewed</p>
          </div>

          <Card className="p-8 border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/20">
            <div className="flex items-start gap-4">
              <Clock className="w-12 h-12 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold text-yellow-900 dark:text-yellow-100">
                  Application Under Review
                </h2>
                <p className="text-yellow-800 dark:text-yellow-200">
                  Your artist verification application has been submitted and is currently being reviewed by our team.
                  You'll be notified once your application has been processed.
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-4">
                  Submitted: {artistStatus.application_date ? new Date(artistStatus.application_date).toLocaleDateString() : 'Recently'}
                </p>
              </div>
            </div>
          </Card>
        </div>
      );
    }

    // Has rejected application
    if (artistStatus?.application_status === 'rejected') {
      return (
        <div className="p-6 space-y-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <XCircle className="w-8 h-8 text-red-500" />
              <h1 className="text-4xl font-bold">Application Not Approved</h1>
            </div>
            <p className="text-muted-foreground">Your previous application was not approved</p>
          </div>

          <Card className="p-8 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20">
            <div className="flex items-start gap-4">
              <XCircle className="w-12 h-12 text-red-600 dark:text-red-400 flex-shrink-0" />
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold text-red-900 dark:text-red-100">
                  Application Rejected
                </h2>
                <p className="text-red-800 dark:text-red-200">
                  Unfortunately, your artist verification application was not approved at this time.
                  Please contact support for more information or to reapply.
                </p>
              </div>
            </div>
          </Card>
        </div>
      );
    }

    // Show application form
    return (
      <div className="p-6 space-y-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="w-8 h-8 text-primary" />
            <h1 className="text-4xl font-bold">Become an Artist</h1>
          </div>
          <p className="text-muted-foreground">Apply for artist verification to upload your music</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="p-6">
            <h2 className="text-2xl font-semibold mb-4">Artist Application</h2>
            <form onSubmit={handleArtistApplication} className="space-y-5">
              <div>
                <label className="block text-sm font-medium mb-2">Artist Name *</label>
                <Input
                  placeholder="Your artist/stage name"
                  value={artistName}
                  onChange={(e) => setArtistName(e.target.value)}
                  disabled={submittingApplication}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Bio * (minimum 50 characters)</label>
                <textarea
                  className="w-full min-h-[120px] px-3 py-2 rounded-md border border-input bg-background text-sm resize-y"
                  placeholder="Tell us about your music, influences, and what makes you unique..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  disabled={submittingApplication}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {bio.length} / 50 characters
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Social Links (optional)</label>
                <Input
                  placeholder="Instagram, SoundCloud, YouTube, etc."
                  value={socialLinks}
                  onChange={(e) => setSocialLinks(e.target.value)}
                  disabled={submittingApplication}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Sample Work URL (optional)</label>
                <Input
                  placeholder="Link to your existing music or portfolio"
                  value={sampleWorkUrl}
                  onChange={(e) => setSampleWorkUrl(e.target.value)}
                  disabled={submittingApplication}
                />
              </div>

              <Button
                type="submit"
                disabled={submittingApplication}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-12 text-lg font-semibold"
              >
                {submittingApplication ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Submit Application
                  </>
                )}
              </Button>
            </form>
          </Card>

          <div className="space-y-4">
            <Card className="p-6 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                    Why Artist Verification?
                  </h3>
                  <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                    <li>✓ Upload your original music</li>
                    <li>✓ Reach underground music lovers</li>
                    <li>✓ Build your fanbase</li>
                    <li>✓ Share your unique sound</li>
                  </ul>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
              <div className="flex gap-3">
                <Check className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                    Application Guidelines
                  </h3>
                  <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                    <li>✓ Original content only</li>
                    <li>✓ Professional bio required</li>
                    <li>✓ Active social presence helps</li>
                    <li>✓ Applications reviewed within 48 hours</li>
                  </ul>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Verified artist - show upload form
  return (
    <div className="p-6 space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <UploadIcon className="w-8 h-8 text-primary" />
          <h1 className="text-4xl font-bold">Upload Music</h1>
          <span className="ml-2 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-medium rounded-full flex items-center gap-1">
            <Check className="w-4 h-4" />
            Verified Artist
          </span>
        </div>
        <p className="text-muted-foreground">Share your music with the community</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Upload Form */}
        <Card className="p-6">
          <form onSubmit={handleUpload} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-2">Song Title *</label>
              <Input
                placeholder="Enter song title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={uploading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Artist Name *</label>
              <Input
                placeholder="Enter artist name"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                disabled={uploading}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Audio Drop Zone */}
              <div>
                <label className="block text-sm font-medium mb-2">Audio File (MP3) *</label>
                <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${audioFile ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                    }`}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const file = e.dataTransfer.files?.[0];
                    if (file && file.type.startsWith('audio/')) {
                      setAudioFile(file);
                      if (!title) setTitle(file.name.replace(/\.[^/.]+$/, ''));
                    } else {
                      toast.error('Please drop a valid audio file');
                    }
                  }}
                >
                  <input
                    id="audio-input"
                    type="file"
                    accept=".mp3,.wav,.ogg,.flac,audio/*"
                    onChange={handleAudioChange}
                    disabled={uploading}
                    className="hidden"
                  />
                  <label
                    htmlFor="audio-input"
                    className="flex flex-col items-center cursor-pointer"
                  >
                    {audioFile ? (
                      <>
                        <Music className="w-8 h-8 text-primary mb-2" />
                        <p className="font-medium text-primary truncate max-w-[200px]">{audioFile.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">{(audioFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                      </>
                    ) : (
                      <>
                        <Music className="w-8 h-8 text-muted-foreground mb-2" />
                        <p className="font-medium">Drop audio or click</p>
                        <p className="text-xs text-muted-foreground mt-1">MP3, WAV, FLAC</p>
                      </>
                    )}
                  </label>
                </div>
              </div>

              {/* Cover Drop Zone */}
              <div>
                <label className="block text-sm font-medium mb-2">Cover Art (Image) *</label>
                <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors relative overflow-hidden ${coverFile ? 'border-primary' : 'border-border hover:border-primary/50'
                    }`}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const file = e.dataTransfer.files?.[0];
                    if (file && file.type.startsWith('image/')) {
                      setCoverFile(file);
                    } else {
                      toast.error('Please drop a valid image file');
                    }
                  }}
                >
                  <input
                    id="cover-input"
                    type="file"
                    accept="image/*"
                    onChange={handleCoverChange}
                    disabled={uploading}
                    className="hidden"
                  />
                  <label
                    htmlFor="cover-input"
                    className="flex flex-col items-center cursor-pointer z-10 relative"
                  >
                    {coverFile ? (
                      <>
                        <img
                          src={URL.createObjectURL(coverFile)}
                          alt="Preview"
                          className="w-16 h-16 object-cover rounded shadow-md mb-2"
                        />
                        <p className="font-medium text-primary truncate max-w-[150px] text-xs">{coverFile.name}</p>
                      </>
                    ) : (
                      <>
                        <UploadIcon className="w-8 h-8 text-muted-foreground mb-2" />
                        <p className="font-medium">Drop image or click</p>
                        <p className="text-xs text-muted-foreground mt-1">JPG, PNG</p>
                      </>
                    )}
                  </label>
                </div>
              </div>
            </div>

            <Button
              type="submit"
              disabled={uploading}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-12 text-lg font-semibold"
            >
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                  Uploading...
                </>
              ) : (
                <>
                  <UploadIcon className="w-5 h-5 mr-2" />
                  Upload Song
                </>
              )}
            </Button>
          </form>
        </Card>

        {/* Info & Guidelines */}
        <div className="space-y-4">
          <Card className="p-6 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                  Upload Guidelines
                </h3>
                <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                  <li>✓ Audio formats: MP3, WAV, OGG, FLAC</li>
                  <li>✓ Cover art: JPG, PNG, WEBP</li>
                  <li>✓ Max file size: 50 MB for audio</li>
                  <li>✓ Cover size: 300x300px minimum</li>
                  <li>✓ Support original content only</li>
                </ul>
              </div>
            </div>
          </Card>

          {/* Upload History */}
          {uploads.length > 0 && (
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Recent Uploads</h3>
              <div className="space-y-3">
                {uploads.slice(-5).map((upload, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-3"
                  >
                    {upload.status === 'success' ? (
                      <Check className="w-5 h-5 text-blue-500 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{upload.fileName}</p>
                      {upload.message && (
                        <p className={`text-xs ${upload.status === 'success' ? 'text-blue-600' : 'text-red-600'}`}>
                          {upload.message}
                        </p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default Upload;
