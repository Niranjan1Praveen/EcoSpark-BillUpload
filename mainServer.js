const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

// Connecting to the Databse
const db = new sqlite3.Database("./Server.db", (err) => {
  if (err) {
    console.error("Error opening database:", err);
  } else {
    console.log("Connected to SQLite database.");
  }
});
// Get UserDetails by AuthToken
app.get("/api/user/:authToken", (req, res) => {
  const { authToken } = req.params;
  console.log("API HIT: /api/user", authToken);

  if (!authToken) {
    return res.status(400).json({ error: "Missing authToken" });
  }

  const query = `SELECT UserScore, Username, Email, Password, Bio FROM UsersTable WHERE UserID = ?`;

  db.get(query, [authToken], (err, row) => {
    if (err) {
      console.error("Database Error:", err.message);
      return res.status(500).json({ error: "Internal server error" });
    }

    if (!row) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ userScore: row.UserScore, userName: row.Username, email: row.Email, password: row.Password, bio: row.Bio });
  });
});
// Signup
app.post("/api/signup", (req, res) => {
  const { username, password, email, authToken, bio } = req.body;

  if (!username || !password || !email || !authToken || !bio) {
    return res.status(400).json({ error: "All fields are required" });
  }

  const sql = `INSERT INTO UsersTable (UserID, UserName, Email, Password, Bio ) VALUES (?, ?, ?, ?, ?)`;
  const params = [authToken, username, email, password, bio];

  db.run(sql, params, function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ message: "User registered successfully", OathID: authToken });
  });
});
// Login
app.post("/api/login", (req, res) => {
  const { username, email, password } = req.body;
  db.get(
    "SELECT * FROM UsersTable WHERE (Username = ? OR Email = ?) AND Password = ?",
    [username, email, password],
    (err, user) => {
      if (err) return res.status(500).json({ error: "Database error" });
      if (!user) return res.status(401).json({ error: "Invalid credentials" });

      res.json({ message: "Login successful", authToken: user.UserID });
    }
  );
});
// Questions
app.get("/api/questions", (req, res) => {
  const query = `SELECT 
                    question_id AS QuestionID, 
                    question_text AS Question, 
                    option_A AS Option1, 
                    score_A AS op1score, 
                    option_B AS Option2, 
                    score_B AS op2score, 
                    option_C AS Option3, 
                    score_C AS op3score, 
                    option_D AS Option4, 
                    score_D AS op4score,
                    (COALESCE(score_A, 0) + COALESCE(score_B, 0) + COALESCE(score_C, 0) + COALESCE(score_D, 0)) AS totalScore 
                 FROM Questions`;

  db.all(query, [], (err, rows) => { 
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});
// Update UserScore
app.post("/api/update-score/:authToken", (req, res) => {
  const { authToken } = req.params;
  const { total_score } = req.body;

  console.log("Received request with:", { authToken, total_score });

  if (!authToken || total_score === undefined) {
    return res.status(400).json({ error: "Missing authToken or total_score" });
  }

  const query = `UPDATE UsersTable SET UserScore = ? WHERE UserID = ?`;

  db.run(query, [total_score, authToken], function (err) {
    if (err) {
      console.error("Database Error:", err.message);
      return res.status(500).json({ error: "Internal server error" });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ message: "Score updated successfully", total_score });
  });
});
// Route to get all electricity bills
app.get("/api/electricity-bills", (req, res) => {
  const query = "SELECT * FROM electricity_bills";
  
  db.all(query, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});
// Route to get all water bills
app.get("/api/water-bills", (req, res) => {
  const query = "SELECT * FROM water_bills";
  
  db.all(query, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});
// Insert challenges into UserChallenges table
app.post("/api/user/challenges", (req, res) => {
  const { authToken, challenges } = req.body; 

  if (!authToken || !challenges || !Array.isArray(challenges)) {
    return res.status(400).json({ error: "Missing authToken or challenges" });
  }

  // Insert each challenge into the UserChallenges table
  const query = `INSERT INTO UserChallenges (UserID, ChallengeText) VALUES (?, ?)`;
  let insertCount = 0;
  challenges.forEach((challenge) => {
    db.run(query, [authToken, challenge], (err) => {
      if (err) {
        console.error("Database Error:", err.message);
        return res.status(500).json({ error: "Failed to insert challenge" });
      }

      insertCount++;
      if (insertCount === challenges.length) {
        res.json({ message: "Challenges saved successfully" });
      }
    });
  });
});
// To store user responses
app.post("/api/submit-responses/:authToken", (req, res) => {
  const { authToken } = req.params;
  console.log("Received data:", req.body); 
  const params = [
    authToken,
    req.body["How many members usually live in your household (including yourself)?"],
    req.body["Do you own or regularly use an electric vehicle (EV)?"],
    req.body["How do you typically wash your clothes?"],
    req.body["Which best describes how you wash your dishes?"],
    req.body["How do you manage indoor temperature during warm seasons?"],
    req.body["Which category best fits the count of major electrical appliances (e.g., refrigerator, washing machine, microwave, TV, water pump, geyser, etc.) in your home?"],
    req.body["How do you and your family members typically bathe?"],
    req.body["How do you use your water heater (geyser) at home?"],
    req.body["Which best describes your toilet flush system?"],
    req.body["How do you operate a motor or water pump to access water (if applicable)?"],
  ];

  const query = `
    INSERT INTO UserResponses (
      UserID,
      "How many members usually live in your household (including yourself)?",
      "Do you own or regularly use an electric vehicle (EV)?",
      "How do you typically wash your clothes?",
      "Which best describes how you wash your dishes?",
      "How do you manage indoor temperature during warm seasons?",
      "Which category best fits the count of major electrical appliances (e.g., refrigerator, washing machine, microwave, TV, water pump, geyser, etc.) in your home?",
      "How do you and your family members typically bathe?",
      "How do you use your water heater (geyser) at home?",
      "Which best describes your toilet flush system?",
      "How do you operate a motor or water pump to access water (if applicable)?"
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(query, params, function (err) {
    if (err) {
      console.error("Error inserting user responses:", err);
      return res.status(500).json({ error: "Failed to store user responses" });
    }

    res.status(201).json({ message: "User responses stored successfully" });
  });
});
// To store appliances data
app.post("/save-appliances/:authToken", (req, res) => {
  const data = req.body;
  const { authToken } = req.params;

  const query = `
    INSERT INTO appliances (
      UserID, washing_machine, washer_dryer_combo, oven, microwave, induction_cooktop,
      toaster, dishwasher, refrigerator_with_ice_water_dispenser, water_purifier_systems,
      water_heater, air_conditioner, fan, water_cooled_air_cooler, vacuum_cleaner,
      steam_cleaner, air_purifier, motorized_water_pumps, tandoor_electric_roti_makers,
      steam_cleaners_misc, cfl_bulb, led_bulb, tube_light, led_tube_light
    ) VALUES (?, ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `;

  const values = [
    authToken,
    data["Washing Machine"] || 0,
    data["Washer-Dryer Combo"] || 0,
    data["Oven"] || 0,
    data["Microwave"] || 0,
    data["Induction Cooktop"] || 0,
    data["Toaster"] || 0,
    data["Dishwasher"] || 0,
    data["Refrigerator with Ice/Water Dispenser"] || 0,
    data["Water Purifier Systems"] || 0,
    data["Water Heater (Geyser)"] || 0,
    data["Air Conditioner"] || 0,
    data["Fan"] || 0,
    data["Water-Cooled Air Cooler"] || 0,
    data["Vacuum Cleaner"] || 0,
    data["Steam Cleaner"] || 0,
    data["Air Purifier"] || 0,
    data["Motorized Water Pumps"] || 0,
    data["Tandoor / Electric Roti Makers"] || 0,
    data["Steam Cleaners"] || 0,
    data["CFL Bulb"] || 0,
    data["LED Bulb"] || 0,
    data["Tube Light"] || 0,
    data["LED Tube Light"] || 0,
  ];

  db.run(query, values, function (err) {
    if (err) {
      console.error(err.message);
      return res.status(500).json({ message: "Database error", error: err.message });
    }
    res.json({ message: "Data saved successfully", user_id: this.lastID });
  });
});
// To get User Challenges
app.get('/user-challenges', (req, res) => {
  const query = 'SELECT * FROM UserChallenges';

  db.all(query, [], (err, rows) => {
      if (err) {
          console.error('Error fetching data from UserChallenges:', err.message);
          return res.status(500).json({ error: 'Failed to fetch data from UserChallenges' });
      }

      // Return the rows as a JSON response
      res.status(200).json({ challenges: rows });
  });
});

app.listen(3001, () => {
  console.log("Server is running on http://localhost:3001");
});
