
import { v2 as cloudinary } from 'cloudinary';
import { configureCloudinary, uploadImage, deleteImage } from '../src/cloudinary';
import { config } from '../src/config';
import { Writable } from 'stream';

// Mock the entire cloudinary module
jest.mock('cloudinary');

// Mock the config module to provide consistent values
jest.mock('../src/config', () => ({
  config: {
    cloudinary: {
      cloudName: 'test-cloud',
      apiKey: 'test-key',
      apiSecret: 'test-secret',
    },
  },
}));

describe('Cloudinary Service', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('configureCloudinary', () => {
    it('should call cloudinary.config with credentials from the config module', () => {
      configureCloudinary();
      expect(cloudinary.config).toHaveBeenCalledWith({
        cloud_name: 'test-cloud',
        api_key: 'test-key',
        api_secret: 'test-secret',
      });
    });
  });

  describe('uploadImage', () => {
    const mockUploadStream = {
      end: jest.fn(),
    } as unknown as Writable;

    beforeEach(() => {
      // Reset the end mock before each test
      (mockUploadStream.end as jest.Mock).mockClear();
      // Setup the mock implementation for upload_stream
      (cloudinary.uploader.upload_stream as jest.Mock).mockReturnValue(mockUploadStream);
    });

    it('should upload an image and resolve with the secure URL', async () => {
      const imageUrl = 'https://cloudinary.com/image.jpg';
      (cloudinary.uploader.upload_stream as jest.Mock).mockImplementation((options, callback) => {
        callback(null, { secure_url: imageUrl });
        return mockUploadStream;
      });

      const imageBuffer = Buffer.from('test-image');
      const result = await uploadImage(imageBuffer);

      expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith({ resource_type: 'image' }, expect.any(Function));
      expect(mockUploadStream.end).toHaveBeenCalledWith(imageBuffer);
      expect(result).toBe(imageUrl);
    });

    it('should reject if the upload stream returns an error', async () => {
      const uploadError = new Error('Upload failed');
      (cloudinary.uploader.upload_stream as jest.Mock).mockImplementation((options, callback) => {
        callback(uploadError, null);
        return mockUploadStream;
      });

      const imageBuffer = Buffer.from('test-image');
      await expect(uploadImage(imageBuffer)).rejects.toThrow(uploadError);
    });

    it('should reject if the result contains no secure_url', async () => {
      (cloudinary.uploader.upload_stream as jest.Mock).mockImplementation((options, callback) => {
        callback(null, { }); // No secure_url in result
        return mockUploadStream;
      });

      const imageBuffer = Buffer.from('test-image');
      await expect(uploadImage(imageBuffer)).rejects.toThrow('Cloudinary upload failed: No secure_url returned.');
    });
  });

  describe('deleteImage', () => {
    it('should resolve when deletion is successful', async () => {
      (cloudinary.uploader.destroy as jest.Mock).mockImplementation((publicId, callback) => {
        callback(null, { result: 'ok' });
      });

      await expect(deleteImage('test-id')).resolves.toBeUndefined();
      expect(cloudinary.uploader.destroy).toHaveBeenCalledWith('test-id', expect.any(Function));
    });

    it('should reject if deletion returns an error', async () => {
      const deletionError = new Error('Deletion failed');
      (cloudinary.uploader.destroy as jest.Mock).mockImplementation((publicId, callback) => {
        callback(deletionError, null);
      });

      await expect(deleteImage('test-id')).rejects.toThrow(deletionError);
    });

    it('should reject if the result is not \'ok\'', async () => {
      (cloudinary.uploader.destroy as jest.Mock).mockImplementation((publicId, callback) => {
        callback(null, { result: 'not found' });
      });

      await expect(deleteImage('test-id')).rejects.toThrow('Cloudinary deletion failed: not found');
    });
  });
});
