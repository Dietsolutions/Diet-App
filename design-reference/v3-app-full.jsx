// v3 full router — all screens, matched to the real app
const { useState } = React;

window.V3AppFull = function V3AppFull({ screen: initial = 'meals' }) {
  const [screen, setScreen] = useState(initial);
  const map = {
    auth: window.V3Auth,
    ob1: window.V3OB1, ob2: window.V3OB2, ob3: window.V3OB3, ob4: window.V3OB4, ob5: window.V3OB5, obGen: window.V3ObGen,
    planOverview: window.V3PlanOverview, planReview: window.V3PlanReview,
    meals: window.V3Meals, meal: window.V3MealDetail, water: window.V3Water,
    tracker: window.V3Tracker, kcal: window.V3Kcal, kcalDark: window.V3KcalDark,
    recipes: window.V3Recipes, shopping: window.V3Shopping,
    tips: window.V3Learn, profile: window.V3Profile,
    replaceSheet: window.V3ReplaceSheet, replaceSearch: window.V3ReplaceSearch, replaceQty: window.V3ReplaceQty,
    replaceAI: window.V3ReplaceAI, replaceResult: window.V3ReplaceResult, mealRegen: window.V3MealRegen,
    addMeal: window.V3AddMeal, weightLog: window.V3WeightLog, weightList: window.V3WeightList,
    customise: window.V3Customise, mealPrep: window.V3MealPrep,
    regenConfirm: window.V3RegenConfirm, regenProgress: window.V3RegenProgress,
    share: window.V3ShareSheet, notifications: window.V3Notifications,
    changeMeal: window.V3ChangeMeal, states: window.V3States, resetPassword: window.V3ResetPassword,
    recipeDetail: window.V3RecipeDetail, saveToPlan: window.V3SaveToPlan,
    mealsNoPlan: window.V3MealsNoPlan, trackerEmpty: window.V3TrackerEmpty,
    forgotPassword: window.V3ForgotPassword, deleteAccount: window.V3DeleteAccount,
    customiseLimit: window.V3CustomiseLimit, regenError: window.V3RegenError,
    mealInstructions: window.V3MealInstructions, changeMealOptions: window.V3ChangeMealOptions,
    replaceCategory: window.V3ReplaceCategory, mealSwapped: window.V3MealDetailSwapped,
    replaceNoResults: window.V3ReplaceNoResults, disclaimer: window.V3Disclaimer,
  };
  const Cmp = map[screen] || window.V3Meals;
  return (
    <div style={{ width:'100%', height:'100%', background: window.v3.paper, overflow:'hidden' }}>
      <Cmp onNav={setScreen}/>
    </div>
  );
};
