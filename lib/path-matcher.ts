/**
 * Path Matcher - Selects the best curated paths for a user based on their profile
 */

import { UserProfile } from '@/types/user';
import { CURATED_PATHS, CuratedPath } from './curated-learning-paths';

export class PathMatcher {
  /**
   * Get the best 2-3 curated paths for a user
   */
  static getBestMatches(
    profile: UserProfile & { personalContext: any },
    viewedModelSlugs: string[] = [],
    completedPathIds: string[] = []
  ): CuratedPath[] {
    // Filter out completed paths
    const availablePaths = CURATED_PATHS.filter(p => !completedPathIds.includes(p.id));

    // Score each path based on relevance
    const scoredPaths = availablePaths.map(path => ({
      path,
      score: this.scorePathRelevance(path, profile, viewedModelSlugs)
    }));

    // Sort by score and return top 2-3
    const topPaths = scoredPaths
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(item => item.path);

    return topPaths;
  }

  /**
   * Score a path's relevance to the user
   */
  private static scorePathRelevance(
    path: CuratedPath,
    profile: UserProfile & { personalContext: any },
    viewedModelSlugs: string[]
  ): number {
    let score = 0;

    // 1. Match experience level (30 points)
    if (profile.experienceLevel === 'beginner' && path.level === 'beginner') {
      score += 30;
    } else if (profile.experienceLevel === 'intermediate' && path.level === 'intermediate') {
      score += 30;
    } else if (profile.experienceLevel === 'advanced' && path.level === 'advanced') {
      score += 30;
    } else if (profile.experienceLevel === 'expert' && path.level === 'advanced') {
      score += 25;
    }

    // 2. Match primary interest (25 points)
    const interest = profile.primaryInterest?.toLowerCase() || '';
    const pathTags = path.tags.join(' ').toLowerCase();
    const pathTitle = path.title.toLowerCase();
    const pathCategory = path.category.toLowerCase();

    if (
      pathTags.includes(interest) ||
      pathTitle.includes(interest) ||
      pathCategory.includes(interest)
    ) {
      score += 25;
    }

    // 3. Match specific challenge (20 points)
    const challenge = profile.personalContext?.specificChallenge?.toLowerCase() || '';
    if (challenge) {
      const challengeWords = challenge.split(' ').filter(w => w.length > 4);
      challengeWords.forEach(word => {
        if (pathTitle.includes(word) || path.description.toLowerCase().includes(word)) {
          score += 5;
        }
      });
    }

    // 4. Freshness - prefer paths with unseen models (15 points)
    const unseenModels = path.modelSlugs.filter(slug => !viewedModelSlugs.includes(slug)).length;
    const freshnessRatio = unseenModels / path.modelSlugs.length;
    score += freshnessRatio * 15;

    // 5. Path length preference (10 points)
    const timeCommitment = profile.timeCommitment || 'moderate';
    const pathLength = path.modelSlugs.length;

    if (timeCommitment === 'minimal' && pathLength <= 4) {
      score += 10;
    } else if (timeCommitment === 'moderate' && pathLength >= 4 && pathLength <= 7) {
      score += 10;
    } else if (timeCommitment === 'significant' && pathLength >= 6) {
      score += 10;
    }

    // 6. Bonus for quick-win paths if user is busy (5 points)
    if (timeCommitment === 'minimal' && path.category === 'quick-win') {
      score += 5;
    }

    // 7. Bonus for cross-domain paths if user wants breadth (5 points)
    if (profile.learningGoals?.includes('breadth') && path.category === 'cross-domain') {
      score += 5;
    }

    return score;
  }
}


