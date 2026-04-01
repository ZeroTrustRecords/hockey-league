import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use(config => {
  const token = localStorage.getItem('hockey_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('hockey_token');
      localStorage.removeItem('hockey_user');
      window.location.href = '/';
    }
    return Promise.reject(err);
  }
);

export default api;
