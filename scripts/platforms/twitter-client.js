/**
 * Twitter/X API Client
 * 
 * Handles posting tweets and threads to Twitter/X
 * Uses Twitter API v2
 */

const https = require('https');
const crypto = require('crypto');

class TwitterClient {
  constructor(config) {
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.accessToken = config.accessToken;
    this.accessTokenSecret = config.accessTokenSecret;
    this.baseURL = 'https://api.twitter.com/2';
  }

  /**
   * Generate OAuth 1.0a signature
   */
  generateOAuthSignature(method, url, params, tokenSecret = '') {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join('&');

    const signatureBase = [
      method.toUpperCase(),
      encodeURIComponent(url),
      encodeURIComponent(sortedParams)
    ].join('&');

    const signingKey = `${encodeURIComponent(this.apiSecret)}&${encodeURIComponent(tokenSecret)}`;
    const signature = crypto
      .createHmac('sha1', signingKey)
      .update(signatureBase)
      .digest('base64');

    return signature;
  }

  /**
   * Generate OAuth header
   */
  generateOAuthHeader(method, url, params = {}) {
    const oauthParams = {
      oauth_consumer_key: this.apiKey,
      oauth_token: this.accessToken,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_nonce: crypto.randomBytes(16).toString('hex'),
      oauth_version: '1.0',
      ...params
    };

    oauthParams.oauth_signature = this.generateOAuthSignature(
      method,
      url,
      oauthParams,
      this.accessTokenSecret
    );

    const authHeader = 'OAuth ' + Object.keys(oauthParams)
      .sort()
      .map(key => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`)
      .join(', ');

    return authHeader;
  }

  /**
   * Make API request
   */
  async makeRequest(method, endpoint, body = null) {
    return new Promise((resolve, reject) => {
      const url = `${this.baseURL}${endpoint}`;
      const urlObj = new URL(url);

      const options = {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method: method,
        headers: {
          'Authorization': this.generateOAuthHeader(method, url, body ? { text: body.text } : {}),
          'Content-Type': 'application/json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed);
            } else {
              reject(new Error(`Twitter API error: ${res.statusCode} - ${JSON.stringify(parsed)}`));
            }
          } catch (error) {
            reject(new Error(`Failed to parse response: ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      if (body) {
        req.write(JSON.stringify(body));
      }

      req.end();
    });
  }

  /**
   * Post a single tweet
   */
  async postTweet(text, replyToTweetId = null) {
    try {
      const body = {
        text: text.substring(0, 280) // Twitter limit
      };

      if (replyToTweetId) {
        body.reply = {
          in_reply_to_tweet_id: replyToTweetId
        };
      }

      const response = await this.makeRequest('POST', '/tweets', body);
      
      return {
        success: true,
        tweetId: response.data.id,
        text: response.data.text
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Post a thread (multiple tweets)
   */
  async postThread(tweets) {
    const results = [];
    let previousTweetId = null;

    for (const tweet of tweets) {
      const result = await this.postTweet(tweet, previousTweetId);
      results.push(result);

      if (!result.success) {
        return { success: false, results, error: result.error };
      }

      previousTweetId = result.tweetId;

      // Wait between tweets
      if (tweet !== tweets[tweets.length - 1]) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    return { success: true, results };
  }
}

module.exports = TwitterClient;

