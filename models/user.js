import mongoose from "mongoose";
import bcrypt from "bcrypt"

const schema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  username: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
    select: false,
  },
  avatar:{
    public_id:{
        type:String,
        required:true,
    },
    url:{
        type:String,
        required:true,
    }
  },
  bio:{
    type:String,
  }
},{
    timestamps:true,
}
);

schema.pre("save",async function(next){
  // to avoid unnecessarily harshing
  if(!this.isModified("password")) return next();

  this.password=await bcrypt.hash(this.password,10);
})

export const User =mongoose.models.User || mongoose.model("User", schema);
