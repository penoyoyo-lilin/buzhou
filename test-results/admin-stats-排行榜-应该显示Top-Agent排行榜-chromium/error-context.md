# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - heading "不周山" [level=3] [ref=e5]
      - paragraph [ref=e6]: 管理后台登录
    - generic [ref=e7]:
      - generic [ref=e8]:
        - generic [ref=e9]: 邮箱或密码错误
        - generic [ref=e10]:
          - text: 邮箱
          - textbox "邮箱" [ref=e11]:
            - /placeholder: admin@buzhou.ai
            - text: admin@buzhou.ai
        - generic [ref=e12]:
          - text: 密码
          - textbox "密码" [ref=e13]:
            - /placeholder: 请输入密码
            - text: admin123456
      - button "登录" [ref=e15] [cursor=pointer]
  - alert [ref=e16]
```