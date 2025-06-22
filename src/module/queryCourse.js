const visit = require('./visit')

/**
 * 根据课程代码查询课程信息
 * @param {Object} config - 配置对象
 * @param {Array} courseCodes - 课程代码数组
 * @returns {Array} 课程信息数组
 */
module.exports = async function queryCourse(config, courseCodes) {
  try {
    // 确保有课程数据
    let lessonDatas = config.lessonDatas
    if (lessonDatas === '') {
      // 如果没有缓存的课程数据，需要先获取
      const result = await visit(
        '/eams/stdElectCourse!data.action?profileId=' + config.profileId,
        config.cookie,
      )
      lessonDatas = result
      config.logger.lessonDatas(result)
    }

    // 解析课程数据
    const match = lessonDatas.match(
      /var\s+lessonJSONs\s*=\s*(\[\s*{[\s\S]*}\s*])/,
    )
    
    if (!match || !match[1]) {
      throw new Error('未找到有效的课程数据，请先登录并获取课程信息')
    }

    const lessonJSONs = new Function(`return ${match[1]};`)()
    
    // 根据课程代码查询课程信息
    const results = courseCodes.map(courseCode => {
      const trimmedCode = courseCode.trim()
      
      // 支持按课程代码(no)或课程名称(name)查询
      const matchedCourses = lessonJSONs.filter(lesson => 
        lesson.no.includes(trimmedCode) || 
        lesson.name.includes(trimmedCode)
      )
      
      return matchedCourses.map(lesson => {
        const {
          id,
          no,
          name,
          teachers,
          teachClassName,
          examModel,
          campusName,
          limitCount,
          electCount,
          credits,
          courseType,
          weekHour,
          timeAndRoom
        } = lesson

        // 计算选课进度
        const selectedCount = parseInt(electCount) || 0
        const totalCount = parseInt(limitCount) || 0
        const progress = totalCount > 0 ? Math.round((selectedCount / totalCount) * 100) : 0
        
        // 判断选课状态
        let status = '可选'
        if (selectedCount >= totalCount && totalCount > 0) {
          status = '已满'
        } else if (selectedCount === 0) {
          status = '空闲'
        }

        return {
          课程序号: no,
          课程名称: name,
          教师: teachers || '未知',
          教学班: teachClassName || '未知',
          选课人数: selectedCount,
          容量: totalCount,
          进度: progress,
          状态: status,
          学分: credits || '未知',
          课程类型: courseType || '未知',
          周学时: weekHour || '未知',
          时间地点: timeAndRoom || '未知',
          校区: campusName || '未知',
          考试方式: examModel || '未知',
          课程ID: id
        }
      })
    }).flat() // 展平数组

    return results
  } catch (error) {
    throw error
  }
}
