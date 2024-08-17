import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://localhost:5000',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

apiClient.interceptors.request.use(request => {
  console.log('Starting Request', request);
  return request;
});

apiClient.interceptors.response.use(response => {
  console.log('Response:', response);
  return response;
}, error => {
  console.log('Error Response:', error.response);
  return Promise.reject(error);
});

export default apiClient;