import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  queries: [
    {
      query: String,
      recommendations: [
        {
          course_id: String,
          course_title: String,
          url: String,
          subject: String,
          level: String,
          is_paid: Boolean,
          price: Number,
          content_duration: String,
          similarity_score: Number
        }
      ],
      createdAt: { type: Date, default: Date.now }
    }
  ]
});

const User = mongoose.model('User', userSchema);
export default User;
