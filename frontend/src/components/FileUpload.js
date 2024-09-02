import React, { useState } from 'react';
import axios from 'axios';

const FileUpload = () => {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleFileChange = (event) => {
    setFile(event.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage('Please select a file to upload.');
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      console.log('Requesting presigned URL for file:', file.name);

      // Request a presigned URL from the server
      const response = await axios.get('http://localhost:5000/generate-presigned-url', {
        params: {
          fileName: file.name,
          fileType: file.type,  // Ensure this matches the actual file type
        },
        withCredentials: false, // Disable credentials for this specific request
      });

      const { url } = response.data;
      console.log('Presigned URL received:', url);

      // Configure the PUT request to the presigned URL
      const options = {
        headers: {
          'Content-Type': file.type,  // Ensure this matches the content-type in the presigned URL
        },
        withCredentials: false, // Disable credentials for this specific request
      };

      console.log('Uploading file to Google Cloud Storage...');
      // Upload the file to Google Cloud Storage using the presigned URL
      await axios.put(url, file, options);

      console.log('File uploaded successfully.');
      setMessage('File uploaded successfully.');
    } catch (err) {
      console.error('Upload failed:', err);

      // Check if the error is a CORS issue or another network error
      if (err.response) {
        console.error('Response data:', err.response.data);
        console.error('Response status:', err.response.status);
        console.error('Response headers:', err.response.headers);
      } else {
        console.error('No response received, network error might have occurred.');
      }

      setMessage(`Failed to upload file: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <h3>Upload a File</h3>
      <input type="file" onChange={handleFileChange} />
      <button onClick={handleUpload} disabled={isLoading}>
        {isLoading ? 'Uploading...' : 'Upload'}
      </button>
      {message && <p>{message}</p>}
    </div>
  );
};

export default FileUpload;