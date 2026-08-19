const apiKey = 'JU7TE2S574463W653KOETCNKH4';

async function run() {
  const searchUrl = `https://api.golfcourseapi.com/v1/search?search_query=Gorge%20Vale`;
  try {
    const res = await fetch(searchUrl, {
      headers: { 'Authorization': `Key ${apiKey}`, 'Accept': 'application/json' }
    });
    const searchData = await res.json();
    if (searchData.courses && searchData.courses.length > 0) {
      const courseId = searchData.courses[0].id;
      const detailUrl = `https://api.golfcourseapi.com/v1/courses/${courseId}`;
      const detailRes = await fetch(detailUrl, {
        headers: { 'Authorization': `Key ${apiKey}`, 'Accept': 'application/json' }
      });
      const detailData = await detailRes.json();
      const course = detailData.course || {};
      console.log("Course Name:", course.course_name);
      console.log("Holes Count:", course.number_of_holes);
      const tees = course.tees || {};
      const maleTees = tees.male || [];
      const femaleTees = tees.female || [];
      console.log("\n--- Male Tees ---");
      maleTees.forEach(t => {
        console.log(`- ${t.tee_name}: ${t.total_yards} yards, Par ${t.par_total}, Rating ${t.course_rating}, Slope ${t.slope_rating}`);
      });
      console.log("\n--- Female Tees ---");
      femaleTees.forEach(t => {
        console.log(`- ${t.tee_name}: ${t.total_yards} yards, Par ${t.par_total}, Rating ${t.course_rating}, Slope ${t.slope_rating}`);
      });
    }
  } catch (err) {
    console.error(err);
  }
}

run();
