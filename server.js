const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();

const CLIENT_ID = 'Ov23liEoyYQNg9NpprWf'; // Replace with your actual Client ID
const CLIENT_SECRET = 'fb25a2e4b41d834ff1e61ea6775a26d65cbece12'; // Replace with your actual Client Secret
const REDIRECT_URI = 'http://localhost:3000/auth/github/callback';

// Set up EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.get('/', (req, res) => {
  res.send('<a href="/auth/github">Login with GitHub</a>');
});

app.get('/auth/github', (req, res) => {
  const redirectUri = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}`;
  res.redirect(redirectUri);
});

app.get('/auth/github/callback', async (req, res) => {
  const code = req.query.code;
  try {
    const tokenResponse = await axios.post('https://github.com/login/oauth/access_token', {
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code
    }, {
      headers: {
        accept: 'application/json'
      }
    });

    const accessToken = tokenResponse.data.access_token;

    // Fetch user's GitHub repositories
    const reposResponse = await axios.get('https://api.github.com/user/repos', {
      headers: {
        Authorization: `token ${accessToken}`
      }
    });

    // Render the repositories in an HTML page
    res.render('repos', { repos: reposResponse.data });
  } catch (error) {
    res.status(500).send('Error during authentication or fetching repositories.');
  }
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
