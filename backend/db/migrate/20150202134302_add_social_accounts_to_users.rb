class AddSocialAccountsToUsers < ActiveRecord::Migration
  def change
    add_column :users, :facebook_account, :string
    add_column :users, :twitter_account, :string
    add_column :users, :is_verified, :boolean
  end
end
