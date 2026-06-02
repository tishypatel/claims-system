import axios from 'axios'

// Base URL is always empty — API is served on the same origin via /api/*
// Vercel routes /api/:path* → serverless function → Express
const api = axios.create({
  baseURL: '',
})

export default api
