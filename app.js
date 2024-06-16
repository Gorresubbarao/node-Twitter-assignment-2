const express = require('express')
const path = require('path')

const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const app = express()

const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
app.use(express.json())
const dbPath = path.join(__dirname, 'twitterClone.db')

let db = null

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server Running at http://localhost:3000/')
    })
  } catch (e) {
    console.log(`DB Error: ${e.message}`)
    process.exit(1)
  }
}

initializeDBAndServer()

// getting followers id's
const getFollowersIds = async username => {
  const getFollowersIdsQuery = `SELECT following_user_id FROM follower
  INNER JOIN user
  ON user.user_id=follower.follower_user_id
  WHERE user.username='${username}'
  `
  const followingPepoles = await db.all(getFollowersIdsQuery)
  const arrayOfIds = followingPepoles.map(eachObj => eachObj.following_user_id)
  return arrayOfIds
}

// athenticationToken checking
const athenticationTokenCheking = (request, response, next) => {
  let jwtToken
  const autherHeader = request.headers['authorization']
  if (autherHeader !== undefined) {
    jwtToken = autherHeader.split(' ')[1]
  }
  if (autherHeader === undefined) {
    response.status(401)
    response.send('Invalid JWT 66')
  } else {
    jwt.verify(jwtToken, 'MY_SCRET_TOKEN', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('123Invalid JWT Token')
      } else {
        request.username = payload.username
        request.userId = payload.userId
        next()
      }
    })
  }
}

// api 1 register
app.post('/register/', async (request, response) => {
  const {username, password, name, gender} = request.body
  const hashedPassword = bcrypt.hash(password, 10)
  const getDbUserQuery = `SELECT * FROM user
  WHERE username = '${username}'`
  const dbUser = await db.get(getDbUserQuery)
  if (dbUser === undefined) {
    const createUserQuery = `INSERT INTO user
    (username, name, password, gender)
    VALUES('${username}', '${name}', '${hashedPassword}', '${gender}')
    `
    if (password.length < 6) {
      response.status(400)
      response.send('Password is too short')
    } else {
      const userData = await db.run(createUserQuery)
      const {userId} = userData.lastID
      response.send('User created successfully')
    }
  } else {
    response.status(400)
    response.send('User already exists')
  }
})

app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const getUserQuery = `SELECT * FROM user WHERE username= '${username}'`
  const dbUser = await db.get(getUserQuery)
  console.log(dbUser)

  if (dbUser !== undefined) {
    const isPasswordMatch = await bcrypt.compare(password, dbUser.password)

    if (isPasswordMatch) {
      const payload = {username, userId: dbUser.user_id}
      const jwtToken = jwt.sign(payload, 'MY_SCRET_TOKEN')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  } else {
    response.status(400)
    response.send('Invalid user')
  }
})

app.get(
  '/user/tweets/feed/',
  athenticationTokenCheking,
  async (request, response) => {
    const {username} = request

    const followingPeopleIds = await getFollowersIds(username)

    const getTweetsQuery = `SELECT
    username,tweet, date_time as dateTime
    FROM user INNER JOIN tweet ON user.user_id = tweet.user_id
    WHERE 
    user.user_id IN (${followingPeopleIds})
    ORDER BY date_time DESC
    LIMIT 4;
    `
    const tweets = await db.all(getTweetsQuery)
    response.send(tweets)
    console.log(tweets)
  },
)

// Returns the list of all names of people whom the user follows api 4
app.get(
  '/user/following/',
  athenticationTokenCheking,
  async (request, response) => {
    const {username, userId} = request
    console.log(userId)
    const getFollowingUsersQuery = `SELECT name FROM follower
    INNER JOIN user ON user.user_id = follower.following_user_id
    WHERE follower_user_id = '${userId}';
    `

    const followingPeople = await db.all(getFollowingUsersQuery)
    response.send(followingPeople)
  },
)

// tweet access athentication
const tweetAccessVerification = async (request, response, next) => {
  const {tweetId} = request.params
  const {userId} = request

  const getTweetQuery = `SELECT
*
FROM tweet INNER JOIN follower
ON tweet.user_id = follower.following_user_id
WHERE tweet.tweet_id = '${tweetId}' AND follower_user_id = '${userId}';`
  const tweet = await db.get(getTweetQuery)
  if (tweet === undefined) {
    response.status(401)
    response.send('Invalid Request')
  } else {
    next()
  }
}

// Returns the list of all names of people whom the user follows api 5
app.get(
  '/user/followers/',
  athenticationTokenCheking,
  async (request, response) => {
    const {username, userId} = request
    const getFollowersQuery = `SELECT DISTINCT name FROM follower
    INNER JOIN user ON user.user_id = follower.follower_user_id
    WHERE following_user_id = '${userId}';
    `
    const followers = await db.all(getFollowersQuery)
    response.send(followers)
  },
)

// api 6
app.get(
  '/tweets/:tweetId/',
  athenticationTokenCheking,
  tweetAccessVerification,
  async (request, response) => {
    const {username, userId} = request
    const {tweetId} = request.params
    const getTweetQuery = `SELECT tweet,
    (SELECT COUNT() FROM like WHERE tweet_id = '${tweetId}') AS likes,
    (SELECT COUNT() FROM reply WHERE tweet_id = '${tweetId}') AS replies,
    date_time AS dateTime
    FROM tweet
    WHERE tweet.tweet_id = '${tweetId}' ;`
    const tweet = await db.get(getTweetQuery)
    response.send(tweet)
  },
)

//If the user requests a tweet of a user he is following, return the list of usernames who liked the tweet API 7
app.get(
  '/tweets/:tweetId/likes/',
  athenticationTokenCheking,
  tweetAccessVerification,
  async (request, response) => {
    const {username, userId} = request
    const {tweetId} = request.params
    const likedTweetQuery = `SELECT username FROM user INNER JOIN like 
    ON user.user_id = like.user_id
    WHERE tweet_id = ${tweetId}`
    const likedUsers = await db.all(likedTweetQuery)
    const arrayOfUserNames = likedUsers.map(eachUser => eachUser.username)
    console.log(likedUsers)
    console.log(arrayOfUserNames)
    response.send({likes: arrayOfUserNames})
  },
)

// If the user requests a tweet of a user he is following, return the list of replies. api 8
app.get(
  '/tweets/:tweetId/replies/',
  athenticationTokenCheking,
  tweetAccessVerification,
  async (request, response) => {
    const {username, userId} = request
    const {tweetId} = request.params
    const getRepliesQuery = `SELECT name, reply FROM user INNER JOIN reply
    ON user.user_id = reply.user_id
    WHERE tweet_id= ${tweetId}`
    const replies = await db.all(getRepliesQuery)
    console.log(replies)
    response.send({replies})
  },
)

//Returns a list of all tweets of the user api 9
app.get(
  '/user/tweets/',
  athenticationTokenCheking,
  async (request, response) => {
    const {userId} = request
    const gettweetsQuery = `SELECT tweet, 
  COUNT(DISTINCT like_id) as likes,
  COUNT(DISTINCT reply_id) as replies,
  date_time as dateTime
   FROM 
  tweet
  LEFT JOIN reply 
  ON tweet.tweet_id = reply.tweet_id
  LEFT JOIN like
  ON reply.tweet_id = like.tweet_id
  WHERE tweet.user_id =${userId}
  GROUP BY tweet.tweet_id`
    const allTweets = await db.all(gettweetsQuery)
    console.log(allTweets)
    response.send(allTweets)
  },
)

//Create a tweet in the tweet table api 10
app.post(
  '/user/tweets/',
  athenticationTokenCheking,
  async (request, response) => {
    const {tweet} = request.body
    const userId = parseInt(request.userId)
    const dateTime = new Date().toJSON().substring(0, 19).replace('T', ' ')
    console.log(dateTime)
    const createTweetQuery = `INSERT INTO 
  tweet (tweet,user_id,date_time)
  VALUES ('${tweet}', ${userId}, '${dateTime}')`
    const createdTweet = await db.run(createTweetQuery)
    console.log(createdTweet)
    response.send('Created a Tweet')
  },
)

// If the user deletes his tweet api 11
app.delete(
  '/tweets/:tweetId/',
  athenticationTokenCheking,
  async (request, response) => {
    const {tweetId} = request.params
    const {userId} = request

    const getTheTweetQuery = `SELECT * FROM tweet WHERE tweet_id = ${tweetId} AND user_id = ${userId}`
    const tweet = await db.get(getTheTweetQuery)
    console.log(tweet)

    if (tweet === undefined) {
      response.status(401)
      response.send('Invalid Request')
    } else {
      const deleteQuery = `DELETE FROM tweet WHERE tweet_id = ${tweetId}`
      const deletedTweet = await db.run(deleteQuery)
      console.log(deletedTweet)
      response.send('Tweet Removed')
    }
  },
)

module.exports = app
