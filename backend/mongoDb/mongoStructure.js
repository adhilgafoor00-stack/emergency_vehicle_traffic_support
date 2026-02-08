const now = new Date();
export const User = () => ({
  name: '',
  email: '',
  password: '',
  createdAt: now,
  updatedAt: now,
  lastLogin: now,
  isVerified: false,
  resetPasswordToken: '', 
  resetPasswordExpiresAt: now,
  verificationToken: '',
   verificationTokenExpiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
});
