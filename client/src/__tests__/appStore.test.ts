import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../store/appStore';
import type { DayPlan, DayTrackerState, ShoppingCategoryData, UserProfile } from '../types';

describe('useAppStore', () => {
  beforeEach(() => {
    useAppStore.setState({
      activeTab: 'meals',
      selectedDayIndex: null,
      calendarContextDate: null,
      selectedDate: '2026-01-13',
      mealsCalendarOffset: 0,
      trackerCalendarMonth: '2026-01',
      planDays: [],
      isGenerated: false,
      mealsPerDay: 4,
      planDuration: 7,
      weekData: [],
      stats: null,
      weekStart: null,
      shoppingCategories: [],
      totalItems: 0,
      boughtItems: 0,
      isShoppingGenerated: false,
      peopleCount: 1,
      profile: null,
      waterByDate: {},
      lastShoppingUpdateTime: null,
      activePlanId: null,
      planWeekStartDate: null,
      showPlanReview: false,
      planReviewMealPlanId: null,
    });
  });

  it('setActiveTab updates activeTab', () => {
    useAppStore.getState().setActiveTab('tracker');
    expect(useAppStore.getState().activeTab).toBe('tracker');
  });

  it('setSelectedDate updates selectedDate', () => {
    useAppStore.getState().setSelectedDate('2026-06-15');
    expect(useAppStore.getState().selectedDate).toBe('2026-06-15');
  });

  it('setPlanDays sets planDays and isGenerated', () => {
    const days: DayPlan[] = [
      { label: 'Day 1', meals: [{ name: 'Oats', description: '', time: '08:00', calories: 400, protein: 15, carbs: 60, fat: 10 }] },
    ];
    useAppStore.getState().setPlanDays(days, true);
    expect(useAppStore.getState().planDays).toEqual(days);
    expect(useAppStore.getState().isGenerated).toBe(true);
  });

  it('toggleMealEaten updates eaten state in weekData', () => {
    const weekData: DayTrackerState[] = [
      { date: '2026-01-13', dayIndex: 0, meals: [{ mealIndex: 0, eaten: false }, { mealIndex: 1, eaten: true }] },
    ];
    useAppStore.setState({ weekData });
    useAppStore.getState().toggleMealEaten('2026-01-13', 0, true);
    expect(useAppStore.getState().weekData[0].meals[0].eaten).toBe(true);
    useAppStore.getState().toggleMealEaten('2026-01-13', 1, false);
    expect(useAppStore.getState().weekData[0].meals[1].eaten).toBe(false);
  });

  it('setWater stores glasses per date', () => {
    useAppStore.getState().setWater('2026-01-13', 5);
    expect(useAppStore.getState().waterByDate['2026-01-13']).toBe(5);
    useAppStore.getState().setWater('2026-01-13', 8);
    expect(useAppStore.getState().waterByDate['2026-01-13']).toBe(8);
  });

  it('navigateToMealsFromTracker sets activeTab, dayIndex, and dates', () => {
    useAppStore.getState().navigateToMealsFromTracker(2, '2026-06-10');
    const s = useAppStore.getState();
    expect(s.activeTab).toBe('meals');
    expect(s.selectedDayIndex).toBe(2);
    expect(s.calendarContextDate).toBe('2026-06-10');
    expect(s.selectedDate).toBe('2026-06-10');
  });

  it('openPlanReview and closePlanReview toggle the review overlay', () => {
    useAppStore.getState().openPlanReview('plan-abc');
    expect(useAppStore.getState().showPlanReview).toBe(true);
    expect(useAppStore.getState().planReviewMealPlanId).toBe('plan-abc');

    useAppStore.getState().closePlanReview();
    expect(useAppStore.getState().showPlanReview).toBe(false);
    expect(useAppStore.getState().planReviewMealPlanId).toBeNull();
  });

  it('openPlanReview works without mealPlanId', () => {
    useAppStore.getState().openPlanReview();
    expect(useAppStore.getState().showPlanReview).toBe(true);
    expect(useAppStore.getState().planReviewMealPlanId).toBeNull();
  });

  it('toggleShoppingItem updates bought state and count', () => {
    const cats: ShoppingCategoryData[] = [
      { name: 'Produce', items: [
        { key: 'a1', name: 'Apple', bought: false },
        { key: 'b1', name: 'Banana', bought: false },
      ]},
    ];
    useAppStore.setState({ shoppingCategories: cats, boughtItems: 0 });

    useAppStore.getState().toggleShoppingItem('a1', true);
    expect(useAppStore.getState().boughtItems).toBe(1);
    expect(useAppStore.getState().shoppingCategories[0].items[0].bought).toBe(true);

    useAppStore.getState().toggleShoppingItem('a1', false);
    expect(useAppStore.getState().boughtItems).toBe(0);
    expect(useAppStore.getState().shoppingCategories[0].items[0].bought).toBe(false);
  });

  it('resetShopping clears bought flags and resets count', () => {
    useAppStore.setState({
      boughtItems: 2,
      shoppingCategories: [{
        name: 'Dairy', items: [
          { key: 'm1', name: 'Milk', bought: true },
          { key: 'c1', name: 'Cheese', bought: true },
        ],
      }],
    });
    useAppStore.getState().resetShopping();
    expect(useAppStore.getState().boughtItems).toBe(0);
    for (const item of useAppStore.getState().shoppingCategories[0].items) {
      expect(item.bought).toBe(false);
    }
  });

  it('setProfile stores the user profile', () => {
    const profile: UserProfile = {
      id: 'p1', userId: 'u1', name: 'Alice', age: 30, gender: 'female',
      country: 'US', city: 'NY', weightKg: 70, heightCm: 170, targetWeightKg: 65,
      mealPreference: 'balanced', cuisinePreferences: [], mealsPerDay: 3,
      eatingWindow: '8h', allergies: [], allergyOther: '', preferredIngredients: [],
      avoidIngredients: [], avoidOther: '', primaryGoal: 'lose', dietIntensity: 'moderate',
      activityLevel: 'active', healthConditions: [], wakeUpTime: '07:00', sleepTime: '22:00',
      cookingStyle: 'simple', kitchenEquipment: [], weeklyBudget: null, budgetCurrency: 'USD',
      waterIntakeGoal: 8, planDuration: 7, tdee: 2000, targetCalories: 1700,
      proteinTarget: 120, fatTarget: 55, carbTarget: 190, fibreTarget: 25, bmi: 24.2,
    };
    useAppStore.getState().setProfile(profile);
    expect(useAppStore.getState().profile).toEqual(profile);
  });

  it('setPeopleCount updates people count', () => {
    useAppStore.getState().setPeopleCount(4);
    expect(useAppStore.getState().peopleCount).toBe(4);
  });

  it('setActivePlanId stores plan id', () => {
    useAppStore.getState().setActivePlanId('plan-42');
    expect(useAppStore.getState().activePlanId).toBe('plan-42');
  });

  it('setMealsPerDay updates meals per day', () => {
    useAppStore.getState().setMealsPerDay(5);
    expect(useAppStore.getState().mealsPerDay).toBe(5);
  });

  it('setPlanDuration updates plan duration', () => {
    useAppStore.getState().setPlanDuration(14);
    expect(useAppStore.getState().planDuration).toBe(14);
  });

  it('setLastShoppingUpdateTime stores epoch ms', () => {
    const t = Date.now();
    useAppStore.getState().setLastShoppingUpdateTime(t);
    expect(useAppStore.getState().lastShoppingUpdateTime).toBe(t);
  });
});
