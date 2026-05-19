import database

engine = database.get_user_engine('test_user')
print('Engine created successfully:', engine.url)
