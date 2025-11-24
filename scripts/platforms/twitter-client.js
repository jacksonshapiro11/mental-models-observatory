/**
 * Twitter/X API Client
 * 
 * Handles posting tweets and threads to Twitter/X
 * Uses Twitter API v2 with OAuth 1.0a
 */

const { TwitterApi } = require('twitter-api-v2');

class TwitterClient {
  constructor(config) {
    // Support both OAuth 1.0a and OAuth 2.0
    if (config.oauth2AccessToken) {
      // OAuth 2.0
      this.client = new TwitterApi(config.oauth2AccessToken);
      this.rwClient = this.client.readWrite;
    } else if (config.apiKey && config.accessToken) {
      // OAuth 1.0a for posting tweets (user context required)
      this.client = new TwitterApi({
        appKey: config.apiKey,
        appSecret: config.apiSecret,
        accessToken: config.accessToken,
        accessTokenSecret: config.accessTokenSecret
      });
      
      // Verify we have a read-write client (OAuth 1.0a should provide this)
      if (!this.client.readWrite) {
        throw new Error('Failed to initialize read-write client. Check OAuth credentials.');
      }
      
      this.rwClient = this.client.readWrite;
    } else {
      throw new Error('No valid OAuth credentials provided');
    }
  }


  /**
   * Post a single tweet
   */
  async postTweet(text, replyToTweetId = null) {
    try {
      const tweetText = text.substring(0, 280); // Twitter limit
      
      let response;
      
      // Try v2 API first (works with Essential/Elevated tiers)
      if (replyToTweetId) {
        // Reply to previous tweet using v2
        response = await this.rwClient.v2.reply(tweetText, replyToTweetId);
      } else {
        // Standalone tweet using v2
        response = await this.rwClient.v2.tweet(tweetText);
      }
      
      return {
        success: true,
        tweetId: response.data.id,
        text: response.data.text
      };
    } catch (error) {
      // Get more detailed error info
      const errorDetails = {
        message: error.message,
        code: error.code,
        data: error.data
      };
      
      // If it's a Twitter API error, include rate limit info
      if (error.rateLimit) {
        errorDetails.rateLimit = error.rateLimit;
      }
      
      // Check if it's an access tier issue
      if (error.code === 453 || (error.data && error.data.errors && error.data.errors.some(e => e.code === 453))) {
        errorDetails.accessTierIssue = true;
        errorDetails.message = 'Your app needs "Essential" or "Elevated" access tier to post tweets. Free tier only allows read access.';
      }
      
      return {
        success: false,
        error: error.message || 'Unknown error',
        details: errorDetails
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


