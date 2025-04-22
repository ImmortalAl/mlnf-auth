const mongoose = require('mongoose');
    require('dotenv').config();

    const connectDB = async () => {
      try {
        console.log('Attempting to connect to MongoDB with URI:', process.env.MONGO_URI.replace(/:([^@]+)@/, ':<hidden>@'));
        await mongoose.connect(process.env.MONGO_URI, {
          useNewUrlParser: true,
          useUnifiedTopology: true,
          serverSelectionTimeoutMS: 30000,
        });
        console.log('MongoDB connected successfully');
        await mongoose.connection.close();
        console.log('Connection closed');
      } catch (err) {
        console.error('MongoDB connection error:', err.message, err.stack);
        process.exit(1);
      }
    };

    connectDB();