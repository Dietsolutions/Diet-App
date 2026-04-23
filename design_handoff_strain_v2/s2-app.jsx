// Strain v2 app router
const { useState } = React;

window.S2App = function S2App({ screen: initial = 'meals' }) {
  const [screen, setScreen] = useState(initial);

  const go = (s) => setScreen(s);

  const map = {
    // auth + onboarding
    auth:            window.S2Auth,
    ob1:             window.S2OB1,
    ob2:             window.S2OB2,
    ob3:             window.S2OB3,
    ob4:             window.S2OB4,
    ob5:             window.S2OB5,

    // core tabs
    meals:           window.S2Meals,
    meal:            window.S2MealDetail,
    water:           window.S2Water,
    tracker:         window.S2Tracker,
    kcal:            window.S2Kcal,
    shopping:        window.S2Shopping,
    tips:            window.S2Tips,
    profile:         window.S2Profile,

    // flows
    replaceSheet:    window.S2ReplaceSheet,
    replaceSearch:   window.S2ReplaceSearch,
    replaceQty:      window.S2ReplaceQty,
    replaceAI:       window.S2ReplaceAI,
    replaceResult:   window.S2ReplaceResult,
    addMeal:         window.S2AddMeal,
    weightLog:       window.S2WeightLog,
    customise:       window.S2Customise,
    mealPrep:        window.S2MealPrep,
    regenConfirm:    window.S2RegenConfirm,
    regenProgress:   window.S2RegenProgress,
  };

  const Cmp = map[screen] || window.S2Meals;
  return (
    <div style={{ width:'100%', height:'100%', background:'#0C0907', overflow:'auto' }}>
      <Cmp onNav={go}/>
    </div>
  );
};
