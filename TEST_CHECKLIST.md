# Progress Tracking - Test Checklist

## Pre-Test Setup
- [ ] Dev server is running (`npm run dev`)
- [ ] Clear localStorage: Open DevTools → Application → Local Storage → Clear All
- [ ] Open browser console to see logs

## Test 1: Initial Personalization Flow

### Steps:
1. [ ] Go to `http://localhost:3000`
2. [ ] Click "Get My Personalized Guide"
3. [ ] Complete the 5-question quiz
4. [ ] Submit and view results page

### Expected Results:
- [ ] See 5-7 learning paths
- [ ] All model previews have numbers (1, 2) - no green checkmarks
- [ ] No "✓ Viewed" badges visible
- [ ] Console shows: `Progress: 0 viewed models, 0 completed paths`
- [ ] Console shows: `Generating paths: 119 unseen models out of 119 total`

## Test 2: View a Model & Track Progress

### Steps:
1. [ ] Click "Start This Path" on any path
2. [ ] Click on the first model in the path
3. [ ] Stay on the page for 65+ seconds (to mark as completed)
4. [ ] Open DevTools → Console
5. [ ] Type: `JSON.parse(localStorage.getItem('learning_progress'))`
6. [ ] Check the output

### Expected Results:
- [ ] `modelsViewed` array has 1 entry with the model slug
- [ ] `timeSpent` is ~65 seconds
- [ ] `completed` is `true`
- [ ] `viewedAt` timestamp is present

## Test 3: View Multiple Models

### Steps:
1. [ ] Go back to the path page
2. [ ] Click on 2 more models
3. [ ] Spend 60+ seconds on each
4. [ ] Check localStorage again

### Expected Results:
- [ ] `modelsViewed` array now has 3 entries
- [ ] Each has `completed: true`
- [ ] `totalTimeSpent` is ~195 seconds (3 × 65)

## Test 4: Return to Results Page

### Steps:
1. [ ] Go to `http://localhost:3000/guide/results`
2. [ ] Observe the path cards

### Expected Results:
- [ ] Previously viewed models show green background
- [ ] Green checkmark icon instead of number
- [ ] "✓ Viewed" badge on model names
- [ ] Console shows: `Progress: 3 viewed models, 0 completed paths`
- [ ] Console shows: `Generating paths: 116 unseen models out of 119 total`

## Test 5: Freshness Scoring

### Steps:
1. [ ] Look at the console logs for "Scored paths"
2. [ ] Check the `freshness` value for each path

### Expected Results:
- [ ] Paths with more unseen models have higher freshness (0.8-1.0)
- [ ] Paths with viewed models have lower freshness (0.5-0.7)
- [ ] Paths are sorted with higher freshness first (if freshness differs by >0.2)

## Test 6: Continuation Flow

### Steps:
1. [ ] Go to `http://localhost:3000/guide/results?continue=deeper`
2. [ ] Observe the paths generated

### Expected Results:
- [ ] Console shows: `Continuation type: deeper`
- [ ] Paths prioritize "deep-mastery" and "challenging" difficulty
- [ ] Still filters out the 3 viewed models
- [ ] Visual indicators still show green checkmarks for viewed models

## Test 7: View Many Models (Edge Case)

### Steps:
1. [ ] Manually add many viewed models to localStorage
2. [ ] In console, run:
```javascript
const progress = JSON.parse(localStorage.getItem('learning_progress'));
const allModels = Array.from({length: 110}, (_, i) => ({
  slug: `model-${i}`,
  viewedAt: Date.now(),
  timeSpent: 60,
  completed: true
}));
progress.modelsViewed = allModels;
localStorage.setItem('learning_progress', JSON.stringify(progress));
```
3. [ ] Refresh the results page

### Expected Results:
- [ ] Console shows: `Generating paths: 9 unseen models out of 119 total`
- [ ] System falls back to using all models (since < 10 unseen)
- [ ] Console shows: `Fallback to all if too few unseen`
- [ ] Paths still generate successfully

## Test 8: Model Page Tracking

### Steps:
1. [ ] Clear localStorage again
2. [ ] Go directly to a model: `http://localhost:3000/models/first-principles-thinking`
3. [ ] Stay for 30 seconds
4. [ ] Navigate away (click back or go to another page)
5. [ ] Check localStorage

### Expected Results:
- [ ] Model is tracked in `modelsViewed`
- [ ] `timeSpent` is ~30 seconds
- [ ] `completed` is `false` (< 60 seconds)

## Test 9: Build & Production Test

### Steps:
1. [ ] Stop dev server
2. [ ] Run: `npm run build`
3. [ ] Check for any TypeScript errors

### Expected Results:
- [ ] Build completes successfully
- [ ] No TypeScript errors
- [ ] No linting errors
- [ ] All files compile correctly

## Test 10: Cross-Browser Check

### Browsers to Test:
- [ ] Chrome/Chromium
- [ ] Firefox
- [ ] Safari (if on Mac)

### For Each Browser:
1. [ ] Complete personalization
2. [ ] View a model
3. [ ] Check localStorage works
4. [ ] Verify visual indicators appear

## Issues Found

Document any issues here:

1. **Issue**: 
   - **Steps to Reproduce**: 
   - **Expected**: 
   - **Actual**: 
   - **Fix**: 

---

## Summary

- [ ] All 10 tests passed
- [ ] No critical issues found
- [ ] Ready for commit and deployment

**Tested By**: _____________
**Date**: _____________
**Browser(s)**: _____________

