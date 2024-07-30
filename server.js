require('dotenv').config(); // Load environment variables from .env file

const express = require('express');
const session = require('express-session');
const axios = require('axios');
const bodyParser = require('body-parser');
const app = express();

// Retrieve configuration from environment variables
const SESSION_SECRET = process.env.SESSION_SECRET || 'default-secret';
const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3000/auth/github/callback';

// Middleware to parse JSON and URL-encoded request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json()); // Middleware for JSON body parsing

// Session management
app.use(session({
  secret: SESSION_SECRET, // Use session secret from environment variables
  resave: false,
  saveUninitialized: true
}));

// Set view engine to EJS
app.set('view engine', 'ejs');

// Route to start GitHub OAuth authentication
app.get('/auth/github', (req, res) => {
  const state = 'your-random-state'; // Generate a random state to prevent CSRF
  const redirectUri = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=repo&state=${state}`;
  console.log(`Redirecting to: ${redirectUri}`); // Debugging line
  res.redirect(redirectUri);
});

// Callback route after GitHub OAuth authentication
app.get('/auth/github/callback', async (req, res) => {
  const code = req.query.code;
  const state = req.query.state; // Verify state parameter for CSRF protection

  console.log(`Received code: ${code}, state: ${state}`); // Debugging line

  try {
    // Exchange the authorization code for an access token
    const tokenResponse = await axios.post('https://github.com/login/oauth/access_token', {
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code
    }, {
      headers: {
        accept: 'application/json'
      }
    });

    console.log(`Token response: ${JSON.stringify(tokenResponse.data)}`); // Debugging line

    const accessToken = tokenResponse.data.access_token;
    req.session.accessToken = accessToken;

    // Fetch user repositories from GitHub API
    const reposResponse = await axios.get('https://api.github.com/user/repos', {
      headers: {
        Authorization: `token ${accessToken}`
      }
    });

    console.log(`Repositories response: ${JSON.stringify(reposResponse.data)}`); // Debugging line

    // Render the repositories using EJS
    res.render('repos', { repos: reposResponse.data });
  } catch (error) {
    console.error('Error during authentication or fetching repositories:', error);
    res.status(500).send('Error during authentication or fetching repositories.');
  }
});

// Route to fetch the content of a specific file in a repository
app.get('/repos/:owner/:repo/contents/:path', async (req, res) => {
  const { owner, repo, path } = req.params;
  const accessToken = req.session.accessToken;

  try {
    const fileResponse = await axios.get(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
      headers: {
        Authorization: `token ${accessToken}`,
        Accept: 'application/vnd.github.v3.raw'
      }
    });

    res.send(fileResponse.data);
  } catch (error) {
    console.error('Error fetching file content:', error);
    res.status(500).send('Error fetching file content.');
  }
});

// Route to create or update a file in a repository
app.post('/repos/:owner/:repo/contents/:path', async (req, res) => {
  const { owner, repo, path } = req.params;
  const accessToken = req.session.accessToken;
  const { content, message } = req.body;

  try {
    // Get the file's SHA if it exists
    let sha;
    try {
      const fileResponse = await axios.get(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
        headers: {
          Authorization: `token ${accessToken}`,
          Accept: 'application/vnd.github.v3+json'
        }
      });
      sha = fileResponse.data.sha;
    } catch (error) {
      if (error.response.status !== 404) {
        throw error;
      }
    }

    const createOrUpdateResponse = await axios.put(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
      message: message || 'Updated via app',
      content: Buffer.from(content).toString('base64'),
      sha: sha
    }, {
      headers: {
        Authorization: `token ${accessToken}`,
        Accept: 'application/vnd.github.v3+json'
      }
    });

    res.json(createOrUpdateResponse.data);
  } catch (error) {
    console.error('Error creating or updating file:', error);
    res.status(500).send('Error creating or updating file.');
  }
});

// Root route to check if the server is running
app.get('/', (req, res) => {
  res.send('Welcome to the GitHub OAuth App! Go to /auth/github to start the OAuth flow.');
});

// Start the server
app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
