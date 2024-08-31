// src/components/FileUpload.js
import React, { useState } from 'react';
import AWS from 'aws-sdk';

const FileUpload = () => {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState('');

  const handleFileChange = (event) => {
    setFile(event.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage('Please select a file to upload.');
      return;
    }

    // Configure AWS SDK with DigitalOcean Spaces credentials
    const s3 = new AWS.S3({
      endpoint: new AWS.Endpoint('https://ams3.digitaloceanspaces.com'),
      accessKeyId: 'DO00QF6QTBALZBKCD4F2',
      secretAccessKey: 'wRL2G59987diTbdbjOpKH148/xj3A08g4TeLyOP2ymM',
    });

    const params = {
      Bucket: 'staging.minutememo', // Your bucket name
      Key: `audio_recordings/${file.name}`, // File path in the bucket
      Body: file,
      ACL: 'public-read', // Optional: This makes the file public
    };

    try {
      console.log('Uploading file to S3 with params:', params);
      const data = await s3.upload(params).promise();
      setMessage(`File uploaded successfully at ${data.Location}`);
    } catch (err) {
      console.error('Upload failed:', err);
      setMessage(`Failed to upload file: ${err.message}`);
    }
  };

  return (
    <div>
      <h3>Upload a File</h3>
      <input type="file" onChange={handleFileChange} />
      <button onClick={handleUpload}>Upload</button>
      {message && <p>{message}</p>}
    </div>
  );
};

export default FileUpload;