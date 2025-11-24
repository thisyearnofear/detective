// src/lib/users.ts
import { UserProfile } from "./types";

// Hardcoded user data for populating bots and for testing.
// In a real application, this would come from a database or live API calls.
export const USERS: UserProfile[] = [
  {
    fid: 1,
    username: "dwr",
    displayName: "Dan Romero",
    pfpUrl: "https://i.imgur.com/vL43u65.jpg",
  },
  {
    fid: 2,
    username: "v",
    displayName: "Vitalik Buterin",
    pfpUrl: "https://i.imgur.com/hVWw51p.jpg",
  },
  {
    fid: 3,
    username: "balajis",
    displayName: "Balaji Srinivasan",
    pfpUrl: "https://i.imgur.com/hL9qIeG.jpg",
  },
  {
    fid: 4,
    username: "jessepollak",
    displayName: "Jesse Pollak",
    pfpUrl: "https://i.imgur.com/0V4F3PE.jpg",
  },
  {
    fid: 5,
    username: "greg",
    displayName: "greg",
    pfpUrl: "https://i.imgur.com/gW2DqT2.jpg",
  },
];
