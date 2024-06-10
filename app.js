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

const getFollowingPeopleIdsOfUser = async username => {
  const getTheFollowingPeopleQuery = `
  SELECT
        following_user_id FROM follower
  INNER JOIN user ON user.user_id = follower.follower_user_id
  WHERE user.username='${username}';`

  const followingPeople = await db.all(getTheFollowingPeopleQuery)
  const arrayOfIds = followingPeople.map(eachUser => eachUser.following_user_id)
  return arrayOfIds
}

// getting followers id's
// const getFollowersIds = async username => {
//   const getFollowersIdsQuery = `SELECT following_user_id FROM follower
//   INNER JOIN user
//   ON user.user_id=follower.follower_user_id
//   WHERE user.username='${username}'
//   `
//   const followingPepoles = await db.all(getFollowersIdsQuery)
//   const arrayOfIds = followingPepoles.map(eachObj => eachObj.following_user_id)
//   return arrayOfIds
// }

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

// api2 login
// app.post('/login/', async (request, response) => {
//   const {username, password} = request.body
//   const getUserQuery = `SELECT * FROM user WHERE username='${username}';`
//   const userDbDetails = await db.get(getUserQuery)
//   if (userDbDetails !== undefined) {
//     const isPasswordCorrect = await bcrypt.compare(
//       password,
//       userDbDetails.password,
//     )

//     if (isPasswordCorrect) {
//       const payload = {username: username, userId: userDbDetails.user_id}
//       const jwtToken = jwt.sign(payload, 'SECRET_KEY')
//       response.send({jwtToken: jwtToken})
//     } else {
//       // scenario 2
//       response.status(400)
//       response.send('Invalid password')
//     }
//   } else {
//     // scenario 1
//     response.status(400)
//     response.send('Invalid user')
//   }
// })

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

// api3
// app.get('/user/tweets/feed/', async (request, response) => {
//   const {username} = request.body
//   const followingPeopleIdQuery = await getFollowersIds(username)
//   const getTweetsQuery = `SELECT username, tweet, date_time as dateTime FROM user INNER JOIN tweet
//   ON user.user_id = tweet.user_id WHERE user.user_id IN (${followingPeopleIdQuery})
//   `
//   const tweets = await db.all(getTweetsQuery)
//   response.send(tweets)
//   console.log(tweets)
// })

app.get(
  '/user/tweets/feed/',
  athenticationTokenCheking,
  async (request, response) => {
    const {username} = request

    const followingPeopleIds = await getFollowingPeopleIdsOfUser(username)

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
  },
)
